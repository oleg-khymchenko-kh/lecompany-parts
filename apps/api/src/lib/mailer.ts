import nodemailer from 'nodemailer';
import { env, isProduction } from '../env.js';

// Without SMTP configured mail is logged instead of sent. That keeps local
// development working and makes a misconfigured production box loud, not silent.
const transport =
  env.SMTP_HOST && env.SMTP_PORT
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth:
          env.SMTP_USER && env.SMTP_PASSWORD
            ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
            : undefined,
      })
    : null;

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  if (!transport) {
    if (isProduction) {
      throw new Error('SMTP is not configured but mail delivery was attempted');
    }
    console.log('\n--- mail (not sent, no SMTP) ---');
    console.log(`to: ${options.to}\nsubject: ${options.subject}\n\n${options.text}`);
    console.log('--- end mail ---\n');
    return;
  }

  await transport.sendMail({ from: env.MAIL_FROM, ...options });
}
