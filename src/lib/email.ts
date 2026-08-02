import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env
const envPath = path.resolve(process.cwd(), '.env');
const envLocalPath = path.resolve(process.cwd(), '.env.local');

if (fs.existsSync(envPath)) dotenv.config({ path: envPath, quiet: true });
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath, override: true, quiet: true });

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email instantly using Nodemailer via Timeweb SMTP
 */
export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  const host = process.env.SMTP_HOST || 'smtp.timeweb.ru';
  // Port 587 is STARTTLS which establishes connections fastest on Timeweb
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'DashAdmin <auth@mydashadmin.ru>';

  console.log(`\n========================================`);
  console.log(`[EMAIL SENDING ATTEMPT]`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`SMTP Host: ${host}:${port}`);
  console.log(`========================================\n`);

  if (host && user && pass) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        connectionTimeout: 4000,
        greetingTimeout: 4000,
        socketTimeout: 4000,
        tls: {
          rejectUnauthorized: false
        }
      });

      const info = await transporter.sendMail({
        from,
        to,
        subject,
        html,
        priority: 'high',
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'High'
        }
      });

      console.log(`[EMAIL SUCCESS] Sent to ${to} via SMTP ${host}:${port}. ID: ${info.messageId}`);
      return true;
    } catch (err: any) {
      console.warn(`[EMAIL ERROR] Failed via SMTP ${host}:${port}:`, err?.message || err);
      return false;
    }
  }

  console.warn(`[EMAIL FAIL] Could not send via SMTP.`);
  return false;
}

/**
 * Generates and sends a 6-digit OTP code email
 */
export async function sendOtpEmail(email: string, code: string): Promise<boolean> {
  const subject = `${code} — Ваш код входа в DashAdmin`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #ffffff; margin: 0; padding: 40px 20px; }
        .container { max-width: 480px; margin: 0 auto; background: #18181b; border-radius: 16px; border: 1px solid #27272a; padding: 32px; text-align: center; }
        .logo { font-size: 24px; font-weight: bold; color: #ffffff; margin-bottom: 24px; letter-spacing: -0.5px; }
        .title { font-size: 20px; font-weight: 600; color: #f4f4f5; margin-bottom: 12px; }
        .desc { font-size: 14px; color: #a1a1aa; margin-bottom: 28px; line-height: 1.5; }
        .code-box { background: #09090b; border: 1px solid #3f3f46; border-radius: 12px; padding: 20px; font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #3b82f6; margin-bottom: 28px; font-family: monospace; }
        .footer { font-size: 12px; color: #71717a; line-height: 1.5; border-top: 1px solid #27272a; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">DashAdmin</div>
        <div class="title">Код подтверждения</div>
        <div class="desc">Используйте этот код для входа в систему DashAdmin. Код действителен в течение 10 минут.</div>
        <div class="code-box">${code}</div>
        <div class="footer">Если вы не запрашивали этот код, просто проигнорируйте это письмо.</div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
}
