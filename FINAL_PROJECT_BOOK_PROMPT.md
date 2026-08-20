# Prompt for Writing My Final Year Project Book — "Cielo Vista"

Copy everything below the line and paste it into an AI assistant (or use it yourself as the master outline). Fill in the few `[BRACKETED]` placeholders first (your name, university, supervisor, etc.).

---

## ROLE

You are an expert academic writer helping a final-year university student write their final project book (dissertation/project report) for a Bachelor's degree. Write in formal academic English, in the third person, with clear chapter and section numbering. The project is **already fully built and working** — your job is to document and explain it, not to design it.

Student: `[YOUR FULL NAME]`
University: `[UNIVERSITY NAME]`
Department/Program: `[e.g., BSc in Information Technology / Software Engineering]`
Supervisor: `[SUPERVISOR NAME]`
Academic year: 2025–2026

## PROJECT TITLE

**Cielo Vista: A Web-Based Apartment Management and Booking System with Integrated Mobile Payments, SMS Notifications, and an AI Chatbot** (a Progressive Web App built for an apartment business in Rwanda).

## WHAT THE SYSTEM IS

Cielo Vista is a full-stack apartment management platform that digitizes the entire lifecycle of running an apartment business: advertising available apartments, taking bookings from prospective tenants, approving tenants, collecting rent through mobile money and card payments, issuing verifiable receipts, handling maintenance requests, tracking staff attendance, and communicating with tenants through SMS, live chat, and an AI chatbot. It is installable on phones and desktops as a Progressive Web App (PWA).

### The problem it solves

Small and medium apartment businesses in Rwanda typically manage tenants manually: bookings by phone call or walk-in, rent collected in cash or raw mobile-money transfers with no receipts, paper records of tenants and maintenance issues, and no way for prospective tenants to see available apartments online. This causes lost records, payment disputes, slow communication, and poor visibility for management. Cielo Vista replaces this with a single online system.

## SYSTEM USERS (ROLES)

1. **Visitor (public)** — browses the public website: home page, apartment listings with photos and prices, about, contact, feedback form, and the AI chatbot. Can start a booking.
2. **Tenant** — registers an account (with OTP verification), logs in, browses and books apartments, pays rent (MTN Mobile Money or card), views payment history and receipts, submits maintenance requests, chats with the manager via live chat (tawk.to), and manages their profile. New tenant registrations go through an **admin approval workflow** before they become active.
3. **Employee** — staff members organized by department, each with its own dashboard: **Reception, Cleaning, Security, Maintenance, IT, and Administration**. Employees log in with email/password (a future upgrade will add RFID card tap-to-login using an ESP32 microcontroller with a PN532 NFC reader). Employees manage bookings, confirm payments, handle maintenance tickets, use an internal staff chat, and **clock in/out of work by scanning a rotating QR code** (attendance tracking).
4. **Manager** — has a dashboard with business analytics (occupancy, revenue charts built with Recharts), oversees employees and bookings, and receives tenant chat messages.
5. **Admin** — highest privilege: approves/rejects tenant registrations, manages bookings, verifies payments and receipts, and oversees the whole system.

## CORE FEATURES (explain each in the book)

1. **Apartment browsing and booking** — public listing pages with images (uploaded to Supabase Storage), pricing (including price-per-day), availability status, and a booking flow that records the booking and notifies staff.
2. **Tenant registration with approval workflow** — a tenant signs up, is verified by OTP, and appears in the admin's "tenant approvals" queue; only approved tenants can occupy an apartment.
3. **Authentication and security** — email/password login with passwords hashed using **bcrypt**, JSON Web Tokens (JWT) for sessions, one-time passwords (OTP) sent for verification, and password-reset flows for tenants, employees, and managers. Database access is protected with Supabase **Row Level Security (RLS)** policies.
4. **Payments** — multiple channels:
   - **MTN Mobile Money (MoMo)** through the official MTN MADAPI developer platform (OAuth 2.0 client-credentials flow, request-to-pay). A **demo/sandbox mode** is used for demonstration because production activation requires MTN's business approval. The checkout is presented in a card-style payment modal.
   - **Stripe** card payments (payment intents) and a manual card entry option.
   - **IntouchPay** mobile-money integration through a dedicated **Python FastAPI backend** service.
   - Admin-side payment **approve / decline / refund** workflows.
5. **Receipts with QR verification** — every confirmed payment generates a receipt containing a **QR code**; scanning it opens a verification endpoint that confirms the receipt is genuine (anti-forgery). Receipt verification is tied to the employee/admin who verified it (foreign key in the database).
6. **SMS notifications** — booking confirmations and payment notifications are sent to tenants' phones through **IntouchSMS** (a Rwandan SMS gateway, HTTP Basic auth, sender ID "Movasdom").
7. **AI chatbot** — a site-wide chat widget powered by a **locally hosted Ollama large language model**, which answers visitor questions about the apartments (prices, availability, booking steps). Conversations are stored in the database with session tracking. Separately, tenants get a human "Chat with Manager" live chat (tawk.to) on their dashboard.
8. **Multilingual support (English ↔ French)** — a site-wide language switcher powered by a **locally hosted LibreTranslate** machine-translation server, so the site serves both anglophone and francophone users.
9. **Staff attendance by QR code** — the system generates rotating QR tokens; employees scan to clock in and clock out, and attendance records are stored and listable.
10. **Maintenance requests** — tenants file requests; maintenance staff track and resolve them.
11. **Internal staff chat** — employees communicate within the system.
12. **Dashboards and analytics** — manager/admin dashboards with charts (revenue, bookings, occupancy) using Recharts.
13. **Progressive Web App** — web manifest and installability, so the site behaves like a mobile app.
14. **Feedback module** — visitors and tenants can submit feedback.

## TECHNOLOGY STACK (Chapter on tools/technologies)

- **Frontend:** Next.js 16 (App Router) with React 19 and TypeScript; Tailwind CSS 4 for styling; shadcn/ui components built on Radix UI primitives; Lucide icons; Recharts for charts; Three.js (react-three-fiber) for 3D visual effects; react-hook-form + Zod for form validation; sonner for toast notifications.
- **Backend (primary):** Next.js API Routes (serverless-style REST endpoints under `/app/api/...`) handling auth, bookings, payments, chat, attendance, receipts, translation, and uploads.
- **Backend (secondary):** a **Python FastAPI microservice** dedicated to IntouchPay mobile-money and IntouchSMS integration, called by the Next.js app over HTTP with CORS.
- **Database:** **Supabase (hosted PostgreSQL)** with Row Level Security; schema evolved through ~26 versioned SQL migration scripts. Key tables: `apartments`, `bookings`, `tenants`, `employees`, `managers`, `tenant_payments`, `receipts`, `card_payment_logs`, `occupied_apartments`, `maintenance_requests`, `chat_conversations`/`chat_messages`, `otp_codes`, `password_resets`, `attendance`, `settings`.
- **File storage:** Supabase Storage for apartment images.
- **External services:** MTN MoMo MADAPI (payments), Stripe (card payments), IntouchPay & IntouchSMS (Rwandan payment/SMS gateway), tawk.to (live chat), Ollama (local LLM for the chatbot), LibreTranslate (local machine translation), Nodemailer (email).
- **Security libraries:** bcryptjs (password hashing), jsonwebtoken (JWT), Zod (input validation).
- **QR tooling:** `qrcode` (generation), `jsqr` / `html5-qrcode` (scanning).
- **Tooling:** pnpm package manager, ESLint, Git/GitHub, VS Code, deployed/runnable locally with `next dev`; PWA manifest for installation.
- **Planned hardware extension (future work):** RFID tap-to-login for employees using an ESP32 microcontroller with a PN532 NFC/RFID reader.

## HOW THE SYSTEM WORKS (architecture narrative — use for the design chapter)

1. The browser loads the Next.js React application (server-rendered pages + client components).
2. User actions (login, booking, payment, chat) call Next.js API routes, which validate input (Zod), enforce auth (JWT/bcrypt), and read/write Supabase PostgreSQL through the Supabase client, with RLS as a second layer of defense.
3. For MTN MoMo payments, the API route obtains an OAuth token from MTN MADAPI and issues a request-to-pay to the tenant's phone; the tenant approves on their handset; the system polls/records the transaction status and, on success, writes a payment row, generates a QR receipt, and triggers an SMS via IntouchSMS.
4. For IntouchPay flows, the Next.js app calls the FastAPI microservice, which talks to the IntouchPay/IntouchSMS APIs.
5. The chatbot widget posts messages to a chat API route, which forwards them (with apartment context) to the local Ollama model and stores the conversation per session.
6. The language switcher sends page text to the local LibreTranslate server and swaps the displayed language (English ↔ French).
7. Attendance QR codes are short-lived tokens issued by an API route; scanning posts a clock-in/clock-out record.

## THE DATABASE (for the ERD and the database section of Chapters 3–4)

The database is a hosted PostgreSQL instance on Supabase, built up through ~27 versioned SQL migration scripts. Authentication uses the system's own credential tables (passwords hashed with bcrypt) rather than Supabase Auth, with role-based authorization enforced at the application level and Row Level Security on selected tables.

### Tables and their purpose

**User/account tables (one per role):**
- `admin_accounts` — admin logins (username, password hash, full name).
- `employees` — staff accounts with `position`, `department` (Reception, Cleaning, Security, Maintenance, IT, Administration), `hire_date`, `status`, `last_login`.
- `managers` — manager accounts; `created_by_admin_id` → `admin_accounts` records which admin created each manager.
- `tenants` — tenant accounts with contact/ID details, emergency contact, plus the approval workflow columns: `approval_status` (pending/approved/rejected), `approved_by` → `admin_accounts`, `approved_at`, `is_active`.

**Property and booking tables:**
- `apartments` — name, type, description, size (m²), bedrooms, bathrooms, `price_per_month`, `price_per_day` (added later for short stays), image URL plus a gallery of additional images, `is_available`.
- `bookings` — a booking of an apartment: `tenant_id` → `tenants` (nullable, because walk-in **guest bookings** have no tenant account — their name, phone, and email are stored on the booking row itself), `apartment_id` → `apartments`, start/end dates, `status` (pending/confirmed/…).
- `occupied_apartments` — records an actual move-in: `apartment_id` → `apartments`, `booking_id` → `bookings`, `tenant_id` → `tenants`, and `marked_by_employee_id` → `employees` (which staff member confirmed the occupancy).

**Payment tables:**
- `tenant_payments` — rent payments: `tenant_id` → `tenants`, `apartment_id` → `apartments`, amount, payment date, due date, `status`, `payment_method`, reference number, Stripe columns (payment intent), and refund columns (added in a later migration).
- `card_payment_logs` — audit log of card transactions: `payment_id` → `tenant_payments`, `tenant_id` → `tenants`, unique `transaction_id`, `card_last_four`, cardholder name, status. Only the last four card digits are stored (security/PCI consideration — worth discussing in the book).
- `receipts` — one QR receipt per paid booking (UUID primary key): `booking_id` → `bookings`, `apartment_id` → `apartments`, `amount_paid`, `payment_intent_id`, `qr_code_base64` (the rendered QR image), `verify_token` (signed token embedded in the QR), `is_verified`, `verified_at`, and `verified_by_admin_id` → `employees` (the reception employee who scanned/verified it at check-in). The receipt deliberately stores a **frozen snapshot** of amount and email so it can never change even if source rows change — an intentional, justified denormalization.

**Operations tables:**
- `maintenance_requests` — `tenant_id` → `tenants`, `apartment_id` → `apartments`, issue type, description, `priority`, `status`, `resolved_at`.
- `attendance` — QR clock-in/clock-out records; `employee_id` → `employees`.
- `employee_schedules` — one row per employee per weekday (`UNIQUE(employee_id, weekday)`): start time, end time, `is_off`; the manager edits these from the dashboard, and Sunday defaults to the day off.
- `internal_messages` — internal staff chat; `employee_id` → `employees` identifies which employee's conversation thread with the manager each message belongs to.

**Support tables:**
- `chat_sessions` / `chat_messages` — AI chatbot conversations: UUID keys, one session per visitor with role/name/email, messages with `sender_role` (user/bot) and JSONB metadata; protected by Row Level Security policies so users only see their own sessions.
- `otp_codes` — one-time passwords with expiry (a migration fixed timezone handling).
- `password_reset_requests` — password-reset tokens for the reset flows.
- `client_feedback` — visitor/tenant feedback with a star `rating` column and `is_read` flag.
- `settings` — key/value system settings.

### Entity relationships (for the ERD)

- One `apartment` has many `bookings`, many `tenant_payments`, many `maintenance_requests`, many `receipts`.
- One `tenant` has many `bookings`, `tenant_payments`, `maintenance_requests`, `card_payment_logs`.
- One `booking` has one `receipt`; one `booking` can produce one `occupied_apartments` record.
- One `employee` has many `attendance` records, seven `employee_schedules` rows, many `internal_messages`, and can verify many `receipts` and mark many `occupied_apartments`.
- One `admin` approves many `tenants` and creates many `managers`.
- One `chat_session` has many `chat_messages`.
- Deletion rules are deliberate: child records CASCADE when the parent tenant is deleted (payments, maintenance), but bookings/receipts SET NULL to preserve history, and `occupied_apartments.marked_by_employee_id` uses RESTRICT so an employee who confirmed occupancies cannot be silently deleted.

### Database normalization (use this as an academic highlight in Chapter 3/4)

The schema was explicitly **normalized to Third Normal Form (3NF)** in a dedicated migration, which makes an excellent discussion section:
1. Dead tables with no rows and no code references were dropped.
2. `tenant_id` columns that had been stored as text were converted to integers and given real foreign keys to `tenants`, so referential integrity is enforced by the database instead of application code.
3. A 3NF violation was fixed: `bookings.apartment_type` duplicated a fact about the apartment, so it was dropped and is now read through the `bookings → apartments` relation.
4. A circular reference between `tenant_payments` and `receipts` was broken by keeping a single direction of reference.
5. Two justified exceptions to strict normalization were kept and documented: guest-booking contact details live on the booking row (there is no tenant row to reference), and receipts keep a frozen copy of the amount/email because a receipt must be an immutable record of the transaction.

## REQUIRED BOOK STRUCTURE

Write the book with this structure (standard final-year project format — adjust to `[YOUR UNIVERSITY'S TEMPLATE]` if it differs):

- **Preliminary pages:** Title page, Declaration, Approval/Certification, Dedication, Acknowledgements, Abstract (≈250 words summarizing problem, methods, technologies, results), Table of Contents, List of Figures, List of Tables, List of Abbreviations (API, CRUD, ERD, FK, JWT, LLM, MoMo, OTP, PWA, QR, REST, RLS, SDLC, SMS, SQL, UI/UX, UML…).
- **Chapter 1 — General Introduction:** background of the study; problem statement (manual apartment management pains described above); general and specific objectives; research questions; scope and limitations (e.g., MoMo runs in sandbox/demo mode pending MTN production approval; RFID login is designed but awaiting hardware); significance of the study; organization of the book.
- **Chapter 2 — Literature Review:** review existing property-management systems (e.g., Buildium, AppFolio, local Rwandan practices), e-payment adoption in Rwanda (MTN MoMo penetration), chatbots in customer service, PWAs vs native apps, and identify the gap this project fills. Cite real, verifiable sources with a consistent referencing style (`[APA or IEEE — pick one]`).
- **Chapter 3 — Methodology and System Analysis & Design:** development methodology (Agile/iterative SDLC); requirements gathering; functional and non-functional requirements; feasibility study; system analysis of the current (manual) vs proposed system. Include described diagrams I can draw: **use case diagrams** (one per role), **ERD** of the database tables listed above, **class diagram**, **sequence diagrams** (booking flow, MoMo payment flow, chatbot message flow, QR attendance flow), **activity diagrams**, and the **three-tier architecture diagram** (client → Next.js API + FastAPI → Supabase PostgreSQL + external services).
- **Chapter 4 — System Implementation:** tools and environment; database implementation (mention migrations and RLS); implementation of each module with 1–2 short representative code excerpts each (auth, booking, MoMo payment, receipt QR, chatbot, translation, attendance); screenshots with captions — insert placeholders like `[Figure 4.x: Screenshot of tenant dashboard]` for me to fill in.
- **Chapter 5 — Testing and Results:** testing strategy (unit, integration, user acceptance); test-case tables (Test ID, description, input, expected result, actual result, pass/fail) covering login, OTP, booking, payment approve/decline/refund, receipt verification, chatbot, translation, attendance; discussion of results.
- **Chapter 6 — Conclusion and Recommendations:** summary of achievements against objectives; challenges encountered (e.g., MTN production activation, integrating multiple payment providers, running local AI models); recommendations and **future work** (RFID/IoT card login with ESP32 + PN532, MoMo production go-live, native mobile app, more languages, online deployment).
- **References** and **Appendices** (sample code, SQL schema, user guide).

## WRITING INSTRUCTIONS

1. Work **chapter by chapter**: when I say "write Chapter 1", produce the full chapter; wait for my feedback before the next.
2. Academic tone, third person ("the system", "the researcher"), no marketing language.
3. Be **accurate to the facts above** — do not invent features that are not listed. Where a figure/screenshot is needed, insert a numbered placeholder.
4. Number all headings (1.1, 1.2, 2.1…), figures, and tables; keep a consistent citation style.
5. Target length: `[e.g., 60–90 pages]` overall — keep each chapter proportionate.
6. When you need information only I have (university template rules, case-study apartment name/location, number of apartments), ask me instead of guessing.
