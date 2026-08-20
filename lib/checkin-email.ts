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

export interface CheckinEmailData {
  to: string;
  tenantName?: string;
  apartmentName: string;
  /** ISO timestamp of the moment the ticket was checked in at reception */
  checkinAt?: string;
  /** yyyy-mm-dd check-out date of the stay, if known */
  checkoutDate?: string | null;
}

// Simple check-in confirmation. Email clients don't support flexbox/grid
// reliably, so everything is tables + inline styles (same as receipt-email).
function generateCheckinHTML(data: CheckinEmailData): string {
  const name = data.tenantName || 'Valued Tenant';
  const when = data.checkinAt ? new Date(data.checkinAt) : new Date();
  const day = when.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: '2-digit' });
  const time = when.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const checkout = data.checkoutDate
    ? new Date(data.checkoutDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' })
    : null;

  return `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#16a34a;padding:20px 32px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;">Welcome to Cielo Vista 🎉</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;color:#18181b;font-size:15px;">Hi ${name},</p>
              <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.6;">
                You have checked in to <strong>${data.apartmentName}</strong>. Your ticket was
                verified at reception and the apartment is now yours. Enjoy your stay!
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;margin:0 0 16px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0 0 6px;color:#166534;font-size:13px;"><strong>Check-in date:</strong> ${day}</p>
                    <p style="margin:0 0 6px;color:#166534;font-size:13px;"><strong>Check-in time:</strong> ${time}</p>
                    ${checkout ? `<p style="margin:0;color:#166534;font-size:13px;"><strong>Check-out date:</strong> ${checkout}</p>` : ''}
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#71717a;font-size:12px;line-height:1.6;">
                Need anything during your stay? Reach us from your tenant dashboard —
                maintenance requests, payments and support are all there.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#fafafa;border-top:1px solid #e4e4e7;padding:14px 32px;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;">Cielo Vista Apartments · Karama Sector, Kigali</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>`;
}

export async function sendCheckinEmail(data: CheckinEmailData): Promise<void> {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.EMAIL_USER,
    to: data.to,
    subject: `Checked in — welcome to ${data.apartmentName}!`,
    html: generateCheckinHTML(data),
  });
}
