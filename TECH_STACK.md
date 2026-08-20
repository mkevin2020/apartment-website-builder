# Cielo Vista — Technology Stack & Architecture

_A complete reference of every technology used in the project and how the pieces fit together._

---

## 1. What the project is

**Cielo Vista** is a full-stack **smart apartment rental & management platform**. It lets people browse and book apartments, pay online, and get a QR-code receipt, while giving the building's staff (reception, maintenance, security, managers, admins) tools to run day-to-day operations — bookings, payments, attendance, maintenance, and more. It works as a website and installs as a mobile app (PWA).

---

## 2. Architecture at a glance

```
                ┌─────────────────────────────┐
                │   Frontend (Next.js + React)│
                │   Web app + installable PWA │
                └──────────────┬──────────────┘
                               │
        ┌──────────────────────┼───────────────────────┐
        │                      │                        │
┌───────▼────────┐   ┌─────────▼──────────┐   ┌─────────▼─────────┐
│ Next.js API    │   │ Supabase           │   │ Python FastAPI    │
│ routes (TS)    │   │ (PostgreSQL DB +   │   │ backend           │
│ auth, bookings,│   │  storage)          │   │ IntouchPay / SMS  │
│ payments, etc. │   └────────────────────┘   └───────────────────┘
└───────┬────────┘
        │ talks to external services:
        ▼
 Stripe · Gmail SMTP · Ollama (AI) · LibreTranslate · IntouchSMS
```

---

## 3. Frontend

| Technology | Purpose |
|---|---|
| **Next.js 16** (App Router, Turbopack) | Core framework — routing, pages, server rendering |
| **React 19** | UI component library |
| **TypeScript** | Typed JavaScript for safer, clearer code |
| **Tailwind CSS v4** | Utility-first styling |
| **Radix UI / shadcn** | Accessible UI components (dialogs, tabs, dropdowns…) |
| **lucide-react** | Icon set |
| **react-hook-form + zod** | Forms and validation |
| **recharts** | Charts / data visualisation |
| **jsQR** | Reading QR codes from the camera |
| **qrcode** | Generating QR codes |
| **next-themes** | Light/dark mode |
| **PWA (manifest + service worker)** | Makes the app installable on phones |

---

## 4. Backend

The project has **two backends** working together.

### 4a. Next.js API Routes (main backend)
- Built into Next.js under `app/api/...`, written in **TypeScript** (Node.js runtime).
- Handles: authentication, bookings, payments, receipts, OTP, attendance, the translation proxy, SMS sending, and more.

### 4b. Python FastAPI backend (`backend/`)
- A separate service for **IntouchPay (mobile money)** and **IntouchSMS**.

| Technology | Purpose |
|---|---|
| **FastAPI** | Python web framework |
| **Uvicorn** | ASGI server that runs FastAPI |
| **Pydantic / pydantic-settings** | Data validation & config |
| **requests / httpx** | Calling the IntouchPay API |
| **python-dotenv** | Loading environment variables |

---

## 5. Database & storage

| Technology | Role |
|---|---|
| **Supabase** | Hosted **PostgreSQL** database + file storage + client SDK |
| Key tables | `tenants`, `employees`, `apartments`, `bookings`, `tenant_payments`, `receipts`, `attendance`, `otp_codes`, … |

---

## 6. External services & integrations

| Service | What it does |
|---|---|
| **Stripe** | Online card payments (Checkout + webhooks) |
| **IntouchPay** | Mobile-money payments (Rwanda) — via the Python backend |
| **IntouchSMS** | SMS notifications & OTP (booking, payment, password reset) |
| **Gmail SMTP (Nodemailer)** | Transactional email (receipts, OTP, confirmations) |
| **Ollama** | Local AI model powering the in-app chatbot |
| **LibreTranslate** | Self-hosted translation for the multi-language switcher (EN/FR/AR/ES/ZH/PT) |

---

## 7. Security

| Technology | Purpose |
|---|---|
| **JWT (jsonwebtoken)** | Signed tokens (e.g. QR receipt verification) |
| **bcryptjs** | Password hashing |
| **Signed rotating tokens** | Office attendance QR codes (can't be forged) |
| **Stripe webhook signatures** | Verifying payment events are genuine |

---

## 8. Key features

- **Online booking** — registered tenants *and* guests (guests pay full price upfront).
- **Payments** — Stripe cards + IntouchPay mobile money, with QR-code receipts.
- **QR receipt verification** — reception scans the QR to check guests in; a used ticket can't be reused.
- **Multi-role dashboards** — tenant, employee (by department), manager, admin.
- **Employee attendance** — login + **office QR verification** so managers know who's really present (RFID card tap planned next).
- **Maintenance requests**, **notifications**, **manager reports** (daily/weekly/yearly, multi-language).
- **AI chatbot**, **multi-language site** (LibreTranslate), **installable mobile app** (PWA).

---

## 9. Tooling & deployment

| Tool | Use |
|---|---|
| **pnpm** | Package manager |
| **Vercel** | Hosting / deployment for the Next.js app |
| **Git / GitHub** | Version control |
| **ngrok** | Exposing the local app for mobile testing |

---

## 10. One-line summary

> **Cielo Vista** is built with a **Next.js (React + TypeScript)** frontend, a **Next.js API + Python FastAPI** backend, a **Supabase (PostgreSQL)** database, and integrations for **Stripe**, **IntouchPay/SMS**, email, AI, and translation — delivered as a web app and an installable mobile app.
