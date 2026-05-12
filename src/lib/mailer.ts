import nodemailer from "nodemailer";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

interface Attachment {
  filename: string;
  content: string;      // base64
  contentType: string;
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
  attachments = [],
  smtp,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Attachment[];
  smtp: SmtpConfig;
}) {
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  await transporter.sendMail({
    from: `TDHC Desk <${smtp.from}>`,
    to,
    subject,
    text,
    ...(html ? { html } : {}),
    attachments: attachments.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content, "base64"),
      contentType: a.contentType,
    })),
  });
}
