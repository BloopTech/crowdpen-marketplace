import nodemailer from "nodemailer";

export async function sendEmail({ to, subject, html, text }) {
  if (!to) throw new Error("Recipient 'to' is required");
  const host = process.env.EMAIL_SERVER_HOST;
  const port = Number(process.env.EMAIL_SERVER_PORT || 465);
  const user = process.env.EMAIL_SERVER_USER;
  const pass = process.env.EMAIL_SERVER_PASSWORD;
  const from = process.env.EMAIL_FROM || `Crowdpen <no-reply@crowdpen.co>`;

  if (!host || !user || !pass) {
    throw new Error("Email server not configured");
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for others
    auth: { user, pass },
  });

  const result = await transport.sendMail({
    from,
    to,
    subject,
    html,
    text,
  });

  const failed = [...(result.rejected || []), ...(result.pending || [])].filter(Boolean);
  if (failed.length) {
    throw new Error(`Email(s) (${failed.join(", ")}) could not be sent`);
  }
  return { ok: true, messageId: result.messageId };
}
