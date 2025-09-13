import dotenv from 'dotenv';
import path from 'path';

// Load environment variables BEFORE anything else
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import dns from 'dns/promises';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import { sendEmail } from './email';
import { getDb } from './db';

const app = express();
const port = process.env.PORT || 3000;

// --- App Configuration ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// --- Middlewares ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'default-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

// --- Custom Type Definitions ---
// Extend session data
declare module 'express-session' {
    interface SessionData {
        user?: { loggedIn: boolean };
    }
}
// Extend Express Request type
interface AuthenticatedRequest extends Request {
    client?: {
        id: number;
        name: string;
        apiKey: string;
        verifiedDomains: string[];
    }
}

// --- Authentication Middlewares ---
const apiKeyAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const providedApiKey = req.headers['x-api-key'] as string;
    if (!providedApiKey) return res.status(401).json({ error: 'Unauthorized: API key is missing' });

    try {
        const db = await getDb();
        const client = await db.get('SELECT * FROM clients WHERE apiKey = ?', providedApiKey);
        if (!client) return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
        
        const domains = await db.all('SELECT domainName FROM domains WHERE clientId = ? AND verified = TRUE', client.id);
        req.client = { ...client, verifiedDomains: domains.map(d => d.domainName) };
        next();
    } catch (error) {
        res.status(500).json({ error: 'Internal server error during authentication' });
    }
};

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.session.user?.loggedIn) {
        next();
    } else {
        res.redirect('/login');
    }
};

// --- Public Routes (API & Login) ---
app.get('/', (req: Request, res: Response) => {
    res.send('Email API is running! Visit /login to access the admin panel.');
});

app.post('/api/send', apiKeyAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { from, to, subject, html } = req.body;
    const client = req.client;
    if (!from || !to || !subject || !html) return res.status(400).json({ error: 'Missing required fields' });

    const fromDomain = from.split('@').pop();
    if (!fromDomain || !client || !client.verifiedDomains.includes(fromDomain)) {
        return res.status(403).json({ error: `Domain <${fromDomain}> is not verified for this client.` });
    }

    try {
        await sendEmail({ from, to, subject, html });

        // Log the email to the database
        const db = await getDb();
        await db.run(
            'INSERT INTO email_logs (clientId, fromAddress, toAddress, subject, body) VALUES (?, ?, ?, ?, ?)',
            client.id,
            from,
            to,
            subject,
            html
        );

        res.status(200).json({ message: 'Email sent successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send email' });
    }
});

app.get('/login', (req: Request, res: Response) => {
    res.render('login', { error: null });
});

app.post('/login', (req: Request, res: Response) => {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USER;
    const adminPass = process.env.ADMIN_PASSWORD;

    if (username === adminUser && password === adminPass) {
        req.session.user = { loggedIn: true };
        res.redirect('/admin');
    } else {
        res.render('login', { error: 'Invalid username or password' });
    }
});

app.get('/logout', (req: Request, res: Response) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/admin');
        }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

// --- Protected Admin Routes ---
const adminRouter = express.Router();
adminRouter.use(requireAuth);

adminRouter.get('/', async (req: Request, res: Response) => {
    try {
        const db = await getDb();
        const clients = await db.all('SELECT * FROM clients ORDER BY name');
        res.render('admin', { clients });
    } catch (error) {
        res.status(500).send('Error loading admin page');
    }
});

adminRouter.get('/dashboard', async (req: Request, res: Response) => {
    try {
        const db = await getDb();
        const totalEmails = await db.get('SELECT COUNT(*) as count FROM email_logs');
        const emailsLast24h = await db.get("SELECT COUNT(*) as count FROM email_logs WHERE sentAt >= datetime('now', '-1 day')");
        const totalClients = await db.get('SELECT COUNT(*) as count FROM clients');

        const logs = await db.all(`
            SELECT
                el.*,
                c.name as clientName
            FROM email_logs el
            JOIN clients c ON el.clientId = c.id
            ORDER BY el.sentAt DESC
            LIMIT 20
        `);

        res.render('dashboard', {
            stats: {
                totalEmails: totalEmails.count,
                emailsLast24h: emailsLast24h.count,
                totalClients: totalClients.count
            },
            logs
        });
    } catch (error) {
        console.error("Dashboard error:", error);
        res.status(500).send('Error loading dashboard');
    }
});

adminRouter.post('/clients', async (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name) return res.status(400).send('Client name is required');
    const newApiKey = crypto.randomBytes(16).toString('hex');
    try {
        const db = await getDb();
        await db.run('INSERT INTO clients (name, apiKey) VALUES (?, ?)', name, newApiKey);
        res.redirect('/admin');
    } catch (error) {
        res.status(500).send('Error creating new client.');
    }
});

adminRouter.post('/clients/:id/delete', async (req: Request, res: Response) => {
    try {
        const db = await getDb();
        await db.run('DELETE FROM clients WHERE id = ?', req.params.id);
        res.redirect('/admin');
    } catch (error) {
        res.status(500).send('Error deleting client.');
    }
});

adminRouter.get('/clients/:id', async (req: Request, res: Response) => {
    try {
        const db = await getDb();
        const client = await db.get('SELECT * FROM clients WHERE id = ?', req.params.id);
        if (!client) return res.status(404).send('Client not found');
        const domains = await db.all('SELECT * FROM domains WHERE clientId = ?', req.params.id);
        res.render('client', { client, domains });
    } catch (error) {
        res.status(500).send('Error loading client page');
    }
});

adminRouter.post('/clients/:id/domains', async (req: Request, res: Response) => {
    const { domainName } = req.body;
    const clientId = req.params.id;
    if (!domainName) return res.status(400).send('Domain name is required');
    try {
        const db = await getDb();
        await db.run('INSERT INTO domains (clientId, domainName) VALUES (?, ?)', clientId, domainName);
        res.redirect(`/admin/clients/${clientId}`);
    } catch (error) {
        res.status(500).send('Error adding domain.');
    }
});

const VERIFICATION_TXT_RECORD_PREFIX = 'my-email-service-verification=';
adminRouter.get('/clients/:clientId/domains/:domainId/verify', async (req: Request, res: Response) => {
    const { clientId, domainId } = req.params;
    try {
        const db = await getDb();
        const domain = await db.get('SELECT * FROM domains WHERE id = ? AND clientId = ?', domainId, clientId);
        if (!domain) return res.status(404).send('Domain not found');
        const expectedTxtRecord = VERIFICATION_TXT_RECORD_PREFIX + domain.domainName;
        const records = await dns.resolveTxt(domain.domainName);
        if (records.some(record => record.includes(expectedTxtRecord))) {
            await db.run('UPDATE domains SET verified = TRUE WHERE id = ?', domainId);
        }
        res.redirect(`/admin/clients/${clientId}`);
    } catch (error) {
        console.error("Verification failed:", error);
        res.redirect(`/admin/clients/${clientId}`);
    }
});

adminRouter.get('/logs/:id', async (req: Request, res: Response) => {
    try {
        const db = await getDb();
        const email = await db.get('SELECT * FROM email_logs WHERE id = ?', req.params.id);
        if (!email) {
            return res.status(404).send('Email log not found');
        }
        res.render('view-email', { email });
    } catch (error) {
        res.status(500).send('Error loading email log');
    }
});

adminRouter.get('/settings', (req: Request, res: Response) => {
    res.render('settings');
});

adminRouter.post('/settings/purge-logs', async (req: Request, res: Response) => {
    try {
        const db = await getDb();
        await db.run('DELETE FROM email_logs');
        res.redirect('/admin/dashboard');
    } catch (error) {
        res.status(500).send('Error purging logs');
    }
});

app.use('/admin', adminRouter);

// --- Scheduled Tasks ---
// Schedule a task to run at midnight every day to purge old logs.
cron.schedule('0 0 * * *', async () => {
    try {
        console.log('Running scheduled job: Purging old email logs...');
        const db = await getDb();
        const result = await db.run("DELETE FROM email_logs WHERE sentAt < datetime('now', '-30 days')");
        console.log(`Purged ${result.changes} old email logs.`);
    } catch (error) {
        console.error('Error during scheduled log purge:', error);
    }
});

// --- Server Initialization ---
getDb().then(() => {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
        console.log(`Admin interface available at http://localhost:${port}/admin`);
    });
}).catch(err => {
    console.error('Failed to connect to the database', err);
    process.exit(1);
});
