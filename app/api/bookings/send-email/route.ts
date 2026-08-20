/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-ignore
import nodemailer from 'nodemailer';
import { NextRequest, NextResponse } from 'next/server';

// Create nodemailer transporter
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transporter: any = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

interface BookingEmailData {
  client_email?: string;
  customerEmail?: string;
  client_name?: string;
  customerName?: string;
  apartment_name?: string;
  apartment_type?: string;
  apartmentName?: string;
  booking_reference?: string;
  bookingReference?: string;
  apartmentPrice?: number;
  price_per_month?: number;
  checkInDate?: string;
  start_date?: string;
  checkOutDate?: string;
  move_out_date?: string;
  numberOfNights?: number;
  totalPrice?: number;
  phone_number?: string;
  apartmentAddress?: string;
  apartmentPhone?: string;
  currency?: string;
}

function generateEmailHTML(data: BookingEmailData): string {
  const currency = data.currency || 'RWF';
  
  // Map field names to normalized values
  const customerName = data.customerName || data.client_name || 'Valued Customer';
  const apartmentName = data.apartmentName || data.apartment_name || 'Apartment';
  const apartmentPrice = data.apartmentPrice || data.price_per_month || 0;
  const checkInDate = data.checkInDate || data.start_date || new Date().toISOString();
  const checkOutDate = data.checkOutDate || data.move_out_date || '';
  const numberOfNights = data.numberOfNights || 1;
  const totalPrice = data.totalPrice || (apartmentPrice * numberOfNights);
  const apartmentAddress = data.apartmentAddress || '';
  const apartmentPhone = data.apartmentPhone || data.phone_number || '';
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 40px 20px;
          text-align: center;
        }
        .header h1 {
          font-size: 28px;
          margin-bottom: 10px;
        }
        .header p {
          font-size: 14px;
          opacity: 0.9;
        }
        .content {
          padding: 40px 20px;
        }
        .section {
          margin-bottom: 30px;
        }
        .section h2 {
          font-size: 18px;
          color: #667eea;
          margin-bottom: 15px;
          border-bottom: 2px solid #667eea;
          padding-bottom: 10px;
        }
        .booking-details {
          background-color: #f9f9f9;
          padding: 20px;
          border-radius: 6px;
          border-left: 4px solid #667eea;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 14px;
        }
        .detail-row:last-child {
          margin-bottom: 0;
        }
        .detail-label {
          font-weight: 600;
          color: #555;
        }
        .detail-value {
          color: #333;
          text-align: right;
        }
        .price-section {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
        }
        .price-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
        }
        .total-price {
          display: flex;
          justify-content: space-between;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 15px;
          border-radius: 6px;
          margin-top: 15px;
          font-size: 18px;
          font-weight: bold;
        }
        .reference {
          background-color: #e8f4f8;
          padding: 15px;
          border-radius: 6px;
          text-align: center;
          margin-bottom: 20px;
        }
        .reference-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .reference-number {
          font-size: 20px;
          font-weight: bold;
          color: #667eea;
          margin-top: 5px;
          font-family: 'Courier New', monospace;
        }
        .next-steps {
          background-color: #f0f7ff;
          padding: 20px;
          border-radius: 6px;
          border-left: 4px solid #667eea;
        }
        .next-steps ul {
          margin-left: 20px;
        }
        .next-steps li {
          margin-bottom: 10px;
          font-size: 14px;
          color: #555;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          margin-top: 20px;
          text-align: center;
        }
        .footer {
          background-color: #f9f9f9;
          padding: 20px;
          text-align: center;
          border-top: 1px solid #ddd;
          font-size: 12px;
          color: #666;
        }
        .footer p {
          margin-bottom: 5px;
        }
        @media (max-width: 600px) {
          .detail-row {
            flex-direction: column;
          }
          .detail-label {
            margin-bottom: 5px;
          }
          .total-price {
            flex-direction: column;
            text-align: center;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <h1>✅ Booking Confirmed!</h1>
          <p>Your apartment reservation has been successfully confirmed</p>
        </div>

        <!-- Content -->
        <div class="content">
          <!-- Greeting -->
          <div class="section">
            <p>Dear <strong>${customerName}</strong>,</p>
            <p style="margin-top: 15px;">Thank you for booking with us! We're excited to have you stay with us. Your reservation details are below.</p>
          </div>

          <!-- Booking Reference -->
          <div class="reference">
            <div class="reference-label">Your Booking Reference</div>
            <div class="reference-number">${data.bookingReference || data.booking_reference || 'BOOKING-' + Date.now()}</div>
          </div>

          <!-- Booking Details -->
          <div class="section">
            <h2>📋 Booking Details</h2>
            <div class="booking-details">
              <div class="detail-row">
                <span class="detail-label">Apartment:</span>
                <span class="detail-value">${apartmentName}</span>
              </div>
              ${data.apartment_type ? `
              <div class="detail-row">
                <span class="detail-label">Type:</span>
                <span class="detail-value">${data.apartment_type}</span>
              </div>
              ` : ''}
              ${apartmentAddress ? `
              <div class="detail-row">
                <span class="detail-label">Address:</span>
                <span class="detail-value">${apartmentAddress}</span>
              </div>
              ` : ''}
              <div class="detail-row">
                <span class="detail-label">Check-in:</span>
                <span class="detail-value">${new Date(checkInDate).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
              </div>
              ${checkOutDate ? `
              <div class="detail-row">
                <span class="detail-label">Check-out:</span>
                <span class="detail-value">${new Date(checkOutDate).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
              </div>
              ` : ''}
              ${numberOfNights > 0 ? `
              <div class="detail-row">
                <span class="detail-label">Number of Nights:</span>
                <span class="detail-value">${numberOfNights}</span>
              </div>
              ` : ''}
              <div class="price-section">
                <div class="price-row">
                  <span class="detail-label">Price per Night:</span>
                  <span>${currency} ${apartmentPrice.toLocaleString()}</span>
                </div>
                <div class="total-price">
                  <span>Total Amount:</span>
                  <span>${currency} ${totalPrice.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Next Steps -->
          <div class="section">
            <h2>📌 What's Next?</h2>
            <div class="next-steps">
              <ul>
                <li><strong>Confirmation:</strong> Please save this email for your records</li>
                <li><strong>Check-in:</strong> Arrive anytime after 3:00 PM on your check-in date</li>
                <li><strong>Check-out:</strong> Please leave by 11:00 AM on your check-out date</li>
                <li><strong>Questions?:</strong> Contact us if you need any assistance</li>
              </ul>
            </div>
          </div>

          <!-- Contact Info -->
          ${apartmentPhone ? `
          <div class="section">
            <h2>📞 Contact Information</h2>
            <p>For any questions or assistance during your stay, please contact us:</p>
            <p style="margin-top: 10px;"><strong>Phone:</strong> ${apartmentPhone}</p>
          </div>
          ` : ''}

          <!-- Footer Message -->
          <div class="section">
            <p>We look forward to welcoming you! If you have any questions or need to make changes to your booking, please don't hesitate to reach out.</p>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>&copy; 2024 Apartment Booking System. All rights reserved.</p>
          <p>This is an automated email. Please do not reply directly to this address.</p>
          <p>Booking Reference: <strong>${data.bookingReference || data.booking_reference || 'BOOKING-' + Date.now()}</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as BookingEmailData;

    // Map and normalize field names
    const email = body.customerEmail || body.client_email;
    const name = body.customerName || body.client_name;
    const apartmentName = body.apartmentName || body.apartment_name;

    // Validate required fields
    if (!email || !name || !apartmentName) {
      console.error('Missing required fields:', { email, name, apartmentName });
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          details: `Email: ${!!email}, Name: ${!!name}, Apartment: ${!!apartmentName}`
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Generate email HTML
    const htmlContent = generateEmailHTML(body);

    // Send email
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.EMAIL_USER,
      to: email,
      subject: `Booking Confirmation - ${body.booking_reference || body.bookingReference || apartmentName}`,
      html: htmlContent,
    };

    console.log('Sending email to:', email);
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully to:', email);

    return NextResponse.json(
      { 
        success: true, 
        message: 'Email sent successfully',
        email: email
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Email sending error:', error);
    
    // Return error with details for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { 
        error: 'Failed to send email', 
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}
