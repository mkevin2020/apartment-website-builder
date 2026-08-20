/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-ignore
import nodemailer from 'nodemailer';

const transporter: any = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export interface DeclineEmailData {
  to: string;
  customerName?: string;
  amount: number;
  currency?: string;
  referenceNumber?: string;
  apartmentName?: string;
}

function declineHTML(data: DeclineEmailData): string {
  const currency = data.currency || 'RWF';
  const name = data.customerName || 'Valued Customer';
  const amount = `${currency} ${Number(data.amount || 0).toLocaleString()}`;

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#333;">
    <div style="max-width:600px;margin:0 auto;padding:24px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h2 style="color:#dc2626;margin:0;">Cielo Vista</h2>
        <p style="color:#666;margin:4px 0;">Payment Update</p>
      </div>

      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:20px;border-radius:8px;margin-bottom:20px;">
        <h3 style="margin-top:0;color:#991b1b;">Your payment was declined</h3>
        <p style="margin:0;">Hello ${name}, your payment of <strong>${amount}</strong>${
          data.referenceNumber ? ` (Ref: ${data.referenceNumber})` : ''
        }${data.apartmentName ? ` for <strong>${data.apartmentName}</strong>` : ''} was reviewed and <strong>declined</strong> by our team.</p>
      </div>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:20px;">
        <p style="margin:0;color:#166534;"><strong>✅ You have been fully refunded.</strong></p>
        <p style="margin:8px 0 0;color:#166534;">No money will be charged. This payment will <strong>not be processed through Stripe</strong>, so nothing will be taken from your card or account.</p>
      </div>

      <p style="color:#555;font-size:14px;line-height:1.7;">
        If you believe this was a mistake, or you'd like to make the payment again, please contact our reception or try the payment once more from your dashboard.
      </p>

      <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:24px;text-align:center;color:#999;font-size:12px;">
        <p style="margin:0;">© ${new Date().getFullYear()} Cielo Vista. All rights reserved.</p>
        <p style="margin:4px 0;">This is an automated message. Please do not reply.</p>
      </div>
    </div>
  </body>
  </html>`;
}

/** Email the tenant that their payment was declined and fully refunded. Throws on failure. */
export async function sendDeclineEmail(data: DeclineEmailData): Promise<void> {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: data.to,
    subject: 'Your payment was declined & fully refunded — Cielo Vista',
    html: declineHTML(data),
  });
}
