import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { renderReceiptHtml, renderReceiptText } from './receipt.service.js';

const hasSmtpConfig = () => Boolean(env.mail.host && env.mail.user && env.mail.pass);

export const sendReceiptEmail = async (receipt) => {
  if (!hasSmtpConfig()) {
    throw new Error('SMTP is not configured. Fill SMTP_HOST, SMTP_USER, SMTP_PASS, and MAIL_FROM in .env.');
  }

  const transporter = nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.secure,
    auth: {
      user: env.mail.user,
      pass: env.mail.pass
    }
  });

  return transporter.sendMail({
    from: env.mail.from,
    to: receipt.recipient_email || receipt.customer_email,
    subject: `Receipt ${receipt.receipt_code} from ${receipt.tenant_name}`,
    text: renderReceiptText(receipt),
    html: renderReceiptHtml(receipt)
  });
};
