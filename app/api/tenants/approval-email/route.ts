/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-ignore
import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";
import { requireRole, ADMIN_OR_MANAGER } from "@/lib/auth/session";

const transporter: any = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

function approvedHTML(name: string): string {
  return `
  <!DOCTYPE html><html><head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Tahoma,sans-serif;color:#333;">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
      <div style="background:linear-gradient(135deg,#16a34a 0%,#059669 100%);color:#fff;padding:40px 20px;text-align:center;">
        <h1 style="margin:0;font-size:28px;">✅ Account Approved</h1>
        <p style="margin:10px 0 0;opacity:0.9;font-size:14px;">Welcome to Cielo Vista</p>
      </div>
      <div style="padding:40px 20px;">
        <p>Dear <strong>${name || "Valued Tenant"}</strong>,</p>
        <p style="margin-top:12px;">Great news — your tenant account has been <strong>approved</strong> by our team. You can now log in and access your tenant portal to view apartments, manage bookings, and make payments.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${BASE_URL}/login" style="display:inline-block;background:linear-gradient(135deg,#16a34a 0%,#059669 100%);color:#fff;padding:12px 30px;text-decoration:none;border-radius:6px;font-weight:600;">Log In to Your Account</a>
        </div>
        <p style="font-size:14px;color:#555;">If you have any questions, feel free to reach out to our team.</p>
      </div>
      <div style="background:#f9f9f9;padding:20px;text-align:center;border-top:1px solid #ddd;font-size:12px;color:#666;">
        <p style="margin:0;">&copy; ${new Date().getFullYear()} Cielo Vista. All rights reserved.</p>
      </div>
    </div>
  </body></html>`;
}

function rejectedHTML(name: string, reason?: string): string {
  return `
  <!DOCTYPE html><html><head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Tahoma,sans-serif;color:#333;">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
      <div style="background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);color:#fff;padding:40px 20px;text-align:center;">
        <h1 style="margin:0;font-size:28px;">Account Application Update</h1>
      </div>
      <div style="padding:40px 20px;">
        <p>Dear <strong>${name || "Applicant"}</strong>,</p>
        <p style="margin-top:12px;">Thank you for your interest in Cielo Vista. After review, we're unable to approve your tenant account at this time.</p>
        ${reason ? `<div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:6px;margin:16px 0;"><p style="margin:0;font-size:14px;"><strong>Reason:</strong> ${reason}</p></div>` : ""}
        <p style="font-size:14px;color:#555;">If you believe this was a mistake or have questions, please contact our support team.</p>
      </div>
      <div style="background:#f9f9f9;padding:20px;text-align:center;border-top:1px solid #ddd;font-size:12px;color:#666;">
        <p style="margin:0;">&copy; ${new Date().getFullYear()} Cielo Vista. All rights reserved.</p>
      </div>
    </div>
  </body></html>`;
}

export async function POST(request: NextRequest) {
  try {
    // Sends approval/decline mail on the company's behalf — staff only, so it
    // cannot be used to send arbitrary branded email to arbitrary addresses.
    await requireRole(request, ADMIN_OR_MANAGER);

    const { email, name, status, reason } = await request.json();

    if (!email || !status) {
      return NextResponse.json({ error: "Missing email or status" }, { status: 400 });
    }

    const isApproved = status === "approved";
    const subject = isApproved
      ? "Your Cielo Vista account has been approved ✅"
      : "Update on your Cielo Vista account application";
    const html = isApproved ? approvedHTML(name) : rejectedHTML(name, reason);

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.EMAIL_USER,
      to: email,
      subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approval email error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send email" },
      { status: 500 }
    );
  }
}
