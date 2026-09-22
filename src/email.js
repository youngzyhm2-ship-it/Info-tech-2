const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Infotechzone <onboarding@resend.dev>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';

const enabled = !!RESEND_API_KEY;
const resend = enabled ? new Resend(RESEND_API_KEY) : null;

if (!enabled) {
  console.warn('RESEND_API_KEY not set — verification emails are disabled (accounts still work, just unverified).');
}

async function sendVerificationEmail(toEmail, fullName, token) {
  if (!enabled) return { sent: false, skipped: true };
  const link = `${FRONTEND_URL}/?verify=${encodeURIComponent(token)}`;
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: toEmail,
    subject: 'Verify your Infotechzone account',
    html: `
      <p>Hi ${fullName || 'there'},</p>
      <p>Thanks for creating an Infotechzone account. Please confirm this is your email address:</p>
      <p><a href="${link}" style="background:#14181D;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">Verify my email</a></p>
      <p>Or paste this link into your browser:<br>${link}</p>
      <p>This link expires in 24 hours. If you didn't create this account, you can ignore this email.</p>
    `,
  });
  if (error) throw new Error(error.message || 'Failed to send verification email.');
  return { sent: true, skipped: false };
}

module.exports = { enabled, sendVerificationEmail };
