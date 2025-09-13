import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// Let's keep it simple and use a file-based database.
const DB_FILE = 'database.sqlite';

// Singleton pattern to ensure only one database connection is opened.
let dbInstance: Awaited<ReturnType<typeof open>> | null = null;

export const getDb = async () => {
    if (dbInstance) {
        return dbInstance;
    }

    const db = await open({
        filename: DB_FILE,
        driver: sqlite3.Database
    });

    // Create tables if they don't exist
    await db.exec(`
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            apiKey TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS domains (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clientId INTEGER NOT NULL,
            domainName TEXT NOT NULL,
            verified BOOLEAN DEFAULT FALSE,
            dkimSelector TEXT,
            dkimPublicKey TEXT,
            FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE CASCADE,
            UNIQUE(clientId, domainName)
        );

        CREATE TABLE IF NOT EXISTS email_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clientId INTEGER NOT NULL,
            sentAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            fromAddress TEXT NOT NULL,
            toAddress TEXT NOT NULL,
            subject TEXT NOT NULL,
            body TEXT,
            FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE CASCADE
        );
    `);

    dbInstance = db;
    return db;
};
