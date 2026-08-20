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

export interface ReceiptEmailData {
  to: string;
  customerName?: string;
  amount: number;
  currency?: string;
  referenceNumber?: string;
  transactionId?: string;
  apartmentName?: string;
  paymentDate?: string;
  receiptUrl?: string;
  /** data:image/png;base64,... — embedded as the scannable QR on the receipt */
  qrCodeBase64?: string;
}

// Monochrome invoice-style receipt matching the on-site InvoiceReceipt component.
// Email clients don't support flexbox/grid reliably, so everything is tables + inline styles.
function generateReceiptHTML(data: ReceiptEmailData): string {
  const currency = (data.currency || 'RWF').toUpperCase();
  const name = data.customerName || 'Valued Customer';
  const amount = Number(data.amount).toLocaleString();
  const paymentDate = data.paymentDate
    ? new Date(data.paymentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' });

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin:0;padding:0;background:#3f3f3f;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#171717;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#3f3f3f;padding:24px 8px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;">
          <tr><td style="padding:36px 36px 0;">

            <!-- Brand row -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="40" valign="middle">
                  <div style="width:34px;height:34px;border-radius:50%;background:#171717;text-align:center;line-height:34px;">
                    <span style="display:inline-block;width:12px;height:12px;border:3px solid #ffffff;border-radius:50%;vertical-align:middle;"></span>
                  </div>
                </td>
                <td valign="middle" style="padding-left:10px;">
                  <p style="margin:0;font-size:15px;font-weight:bold;color:#171717;">Cielo Vista Apartments</p>
                  <p style="margin:0;font-size:11px;color:#8a8a8a;">Premium Residences — Kigali, Rwanda</p>
                </td>
              </tr>
            </table>

            <!-- Title -->
            <h1 style="margin:28px 0 2px;font-size:44px;letter-spacing:-1px;color:#171717;font-weight:800;">INVOICE</h1>
            <p style="margin:0;font-size:12px;color:#9a9a9a;">Document Payment Information</p>

            <!-- Reference box -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;margin-top:20px;">
              <tr>
                <td width="50%" align="center" style="padding:14px 10px;border-right:1px solid #d8d8d8;">
                  <p style="margin:0;font-size:11px;color:#8a8a8a;">Receipt No:</p>
                  <p style="margin:3px 0 0;font-size:14px;font-weight:bold;color:#171717;">${data.referenceNumber || 'N/A'}</p>
                </td>
                <td width="50%" align="center" style="padding:14px 10px;">
                  <p style="margin:0;font-size:11px;color:#8a8a8a;">Date:</p>
                  <p style="margin:3px 0 0;font-size:14px;font-weight:bold;color:#171717;">${paymentDate}</p>
                </td>
              </tr>
            </table>

            <!-- Billed to / payment method -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
              <tr>
                <td width="50%" valign="top">
                  <p style="margin:0;font-size:12px;font-weight:bold;color:#171717;">To</p>
                  <div style="width:30px;height:2px;background:#171717;margin:6px 0 8px;"></div>
                  <p style="margin:0;font-size:13px;color:#555555;">${name}</p>
                  <p style="margin:2px 0 0;font-size:12px;color:#8a8a8a;">${data.to}</p>
                </td>
                <td width="50%" valign="top">
                  <p style="margin:0;font-size:12px;font-weight:bold;color:#171717;">Payment Method</p>
                  <div style="width:30px;height:2px;background:#171717;margin:6px 0 8px;"></div>
                  <p style="margin:0;font-size:13px;color:#555555;">Card payment via Stripe</p>
                  ${data.transactionId ? `<p style="margin:2px 0 0;font-size:11px;color:#8a8a8a;font-family:'Courier New',monospace;word-break:break-all;">${data.transactionId}</p>` : ''}
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Items table -->
          <tr><td style="padding:28px 36px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr style="background:#171717;">
                <td style="padding:12px 16px;font-size:12px;font-weight:bold;color:#ffffff;">Item Description</td>
                <td align="right" style="padding:12px 16px;font-size:12px;font-weight:bold;color:#ffffff;">Unit</td>
                <td align="right" style="padding:12px 16px;font-size:12px;font-weight:bold;color:#ffffff;">Subtotal</td>
              </tr>
              <tr>
                <td style="padding:14px 16px;font-size:13px;color:#171717;border-bottom:1px solid #ededed;">Rent — ${data.apartmentName || 'Apartment'}</td>
                <td align="right" style="padding:14px 16px;font-size:13px;color:#555555;border-bottom:1px solid #ededed;">Payment</td>
                <td align="right" style="padding:14px 16px;font-size:13px;font-weight:bold;color:#171717;border-bottom:1px solid #ededed;">${amount}</td>
              </tr>
            </table>

            <!-- Totals -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
              <tr>
                <td style="font-size:13px;color:#171717;font-weight:bold;padding:4px 16px;">Subtotal</td>
                <td align="right" style="font-size:13px;color:#171717;font-weight:bold;padding:4px 16px;">${currency} ${amount}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#171717;font-weight:bold;padding:4px 16px;">Tax / VAT (0%)</td>
                <td align="right" style="font-size:13px;color:#171717;font-weight:bold;padding:4px 16px;">${currency} 0</td>
              </tr>
              <tr>
                <td style="font-size:16px;color:#171717;font-weight:800;padding:8px 16px;border-top:2px solid #171717;">Total</td>
                <td align="right" style="font-size:16px;color:#171717;font-weight:800;padding:8px 16px;border-top:2px solid #171717;">${currency} ${amount}</td>
              </tr>
            </table>
          </td></tr>

          <!-- QR -->
          ${data.qrCodeBase64 ? `
          <tr><td align="center" style="padding:28px 36px 0;">
            <p style="margin:0 0 10px;font-size:11px;color:#8a8a8a;text-transform:uppercase;letter-spacing:1px;">Verification QR Code</p>
            <img src="cid:receiptqr" alt="Receipt QR Code" width="150" height="150" style="border:1px solid #e5e5e5;padding:8px;background:#ffffff;" />
            <p style="margin:8px 0 0;font-size:11px;color:#9a9a9a;">Show this at reception to verify your receipt</p>
          </td></tr>` : ''}

          <!-- CTA -->
          ${data.receiptUrl ? `
          <tr><td align="center" style="padding:26px 36px 0;">
            <a href="${data.receiptUrl}" style="display:inline-block;background:#171717;color:#ffffff;padding:13px 34px;text-decoration:none;font-weight:600;font-size:13px;">
              View / Download Invoice
            </a>
          </td></tr>` : ''}

          <!-- Footer -->
          <tr><td style="padding:30px 36px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e5e5;">
              <tr>
                <td valign="top" style="padding-top:16px;">
                  <p style="margin:0;font-size:10px;color:#9a9a9a;line-height:1.6;max-width:260px;">
                    This receipt was generated automatically after a successful payment and does not require a signature. Please keep it for your records.
                  </p>
                </td>
                <td valign="top" align="right" style="padding-top:16px;">
                  <p style="margin:0;font-size:11px;color:#555555;">support@cielovista.rw</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#555555;">Kigali, Rwanda</p>
                  <p style="margin:8px 0 0;font-size:10px;color:#9a9a9a;">&copy; ${new Date().getFullYear()} Cielo Vista</p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>`;
}

export async function sendReceiptEmail(data: ReceiptEmailData): Promise<void> {
  const html = generateReceiptHTML(data);

  // Embed the QR as a CID attachment — Gmail and most clients strip inline
  // data:base64 <img> tags, but render attachments referenced by Content-ID.
  const attachments: any[] = [];
  if (data.qrCodeBase64) {
    const m = data.qrCodeBase64.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
    if (m) {
      attachments.push({
        filename: 'receipt-qr.png',
        content: Buffer.from(m[2], 'base64'),
        contentType: m[1],
        cid: 'receiptqr',
      });
    }
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.EMAIL_USER,
    to: data.to,
    subject: `Payment Receipt${data.referenceNumber ? ` - ${data.referenceNumber}` : ''}`,
    html,
    attachments,
  });
}
