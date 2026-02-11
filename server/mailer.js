// server/mailer.js
const nodemailer = require("nodemailer");

function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransport() {
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

async function sendEmail({ to, subject, html, text }) {
  if (!smtpConfigured()) return { sent: false, reason: "smtp_not_configured" };

  const transporter = getTransport();
  const from = process.env.SMTP_FROM || "no-reply@maximumatlas.com";

  const info = await transporter.sendMail({ from, to, subject, text, html });
  return { sent: true, messageId: info.messageId };
}

module.exports = { sendEmail, smtpConfigured };
