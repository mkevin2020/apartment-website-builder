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

export interface RefundEmailData {
  to: string;
  customerName?: string;
  amount: number;
  currency?: string;
  referenceNumber?: string;
  apartmentName?: string;
}

function refundHTML(data: RefundEmailData): string {
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
        <h2 style="color:#16a34a;margin:0;">Cielo Vista</h2>
        <p style="color:#666;margin:4px 0;">Refund Confirmation</p>
      </div>

      <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:20px;border-radius:8px;margin-bottom:20px;">
        <h3 style="margin-top:0;color:#166534;">✅ You have been refunded</h3>
        <p style="margin:0;">Hello ${name}, your refund of <strong>${amount}</strong>${
          data.referenceNumber ? ` (Ref: ${data.referenceNumber})` : ''
        }${data.apartmentName ? ` for <strong>${data.apartmentName}</strong>` : ''} has been processed.</p>
      </div>

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;margin-bottom:20px;">
        <p style="margin:0;color:#1e40af;">The money has been <strong>refunded to your original payment method through Stripe</strong>. Depending on your bank, it may take a few business days to appear on your statement.</p>
      </div>

      <p style="color:#555;font-size:14px;line-height:1.7;">
        If you have any questions about this refund, please contact our reception.
      </p>

      <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:24px;text-align:center;color:#999;font-size:12px;">
        <p style="margin:0;">© ${new Date().getFullYear()} Cielo Vista. All rights reserved.</p>
        <p style="margin:4px 0;">This is an automated message. Please do not reply.</p>
      </div>
    </div>
  </body>
  </html>`;
}

/** Email the customer that their refund has been processed. Throws on failure. */
export async function sendRefundEmail(data: RefundEmailData): Promise<void> {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: data.to,
    subject: 'Your refund has been processed — Cielo Vista',
    html: refundHTML(data),
  });
}
