import { sendEmail } from './email';
import { getDb } from './db';

interface EmailJob {
  from: string;
  to: string;
  subject: string;
  html: string;
  clientId: number;
}

const queue: EmailJob[] = [];
let isProcessing = false;

// Function to add a job to the queue
export const addEmailToQueue = (job: EmailJob) => {
  queue.push(job);
  // Start processing if not already running
  if (!isProcessing) {
    processQueue();
  }
};

// The "worker" that processes the queue
const processQueue = async () => {
  isProcessing = true;

  while (queue.length > 0) {
    const job = queue.shift(); // Get the next job

    if (job) {
      try {
        console.log(`Processing email job for: ${job.to}`);
        await sendEmail(job);
        
        // Log the email to the database after successful sending
        const db = await getDb();
        await db.run(
            'INSERT INTO email_logs (clientId, fromAddress, toAddress, subject, body) VALUES (?, ?, ?, ?, ?)',
            job.clientId,
            job.from,
            job.to,
            job.subject,
            job.html
        );

      } catch (error) {
        console.error(`Failed to send email to ${job.to}:`, error);
        // In a real queue, you would handle retries or move to a "failed" queue
      }
    }
  }

  isProcessing = false;
};
