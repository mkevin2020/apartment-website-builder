# MTN MoMo Payment System - Architecture & Integration Guide

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    TENANT DASHBOARD (Frontend)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ app/tenant/payments/page.tsx                             │   │
│  │ - Display payment list                                   │   │
│  │ - Show pending payments                                  │   │
│  │ - Import MTNMoMoPaymentWidget                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           │                                       │
│                           ↓                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ components/MTNMoMoPaymentWidget.tsx                      │   │
│  │ - Phone input                                            │   │
│  │ - Payment request button                                 │   │
│  │ - Status checking                                        │   │
│  │ - Real-time updates                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
           │                                        △
           │ POST /api/payments/mtn-momo          │
           │ GET  /api/payments/mtn-momo          │ Response
           ↓                                        │
┌─────────────────────────────────────────────────────────────────┐
│                      API ROUTES (Backend)                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ app/api/payments/mtn-momo/route.ts                       │   │
│  │                                                          │   │
│  │ POST Handler:                                            │   │
│  │ 1. Validate input (paymentId, phoneNumber, amount)      │   │
│  │ 2. Call mtnMomoService.requestToPay()                   │   │
│  │ 3. Get transactionId back                                │   │
│  │ 4. Update tenant_payments table                          │   │
│  │ 5. Log transaction in mtn_momo_logs                      │   │
│  │ 6. Return { transactionId, status }                      │   │
│  │                                                          │   │
│  │ GET Handler:                                              │   │
│  │ 1. Get transactionId from query params                   │   │
│  │ 2. Call mtnMomoService.getTransactionStatus()            │   │
│  │ 3. Update tenant_payments if successful                  │   │
│  │ 4. Log status check                                      │   │
│  │ 5. Return { status, financial_transaction_id }           │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
           │                                        △
           │ Call service methods                  │ Response
           ↓                                        │
┌─────────────────────────────────────────────────────────────────┐
│                   SERVICE LAYER (Business Logic)                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ lib/mtn-momo-service.ts                                  │   │
│  │                                                          │   │
│  │ Class: MTNMoMoService                                    │   │
│  │                                                          │   │
│  │ Methods:                                                 │   │
│  │ • getAccessToken()                                       │   │
│  │   - Authenticates with MTN API                           │   │
│  │   - Returns bearer token                                 │   │
│  │                                                          │   │
│  │ • requestToPay(phone, amount, externalId, ...)          │   │
│  │   - Sends payment request to MTN                         │   │
│  │   - User gets prompt on their phone                      │   │
│  │   - Returns unique transactionId                         │   │
│  │                                                          │   │
│  │ • getTransactionStatus(transactionId)                    │   │
│  │   - Checks if payment was successful                     │   │
│  │   - Returns: SUCCESSFUL, PENDING, FAILED                 │   │
│  │                                                          │   │
│  │ • createApiUser() [Setup only]                           │   │
│  │   - Creates API user for first-time setup                │   │
│  │   - Returns API User ID & API Key                        │   │
│  │                                                          │   │
│  │ Utilities:                                               │   │
│  │ • formatPhoneNumber() - Ensures +256... format           │   │
│  │ • formatAmount() - Decimal formatting                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
           │                                        △
           │ HTTPS POST/GET                        │ JSON
           │ With Authorization Headers            │ Response
           ↓                                        │
┌─────────────────────────────────────────────────────────────────┐
│                   MTN MoMo External API                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ SANDBOX: sandbox.momodeveloper.mtn.com                  │   │
│  │ PROD:    api.momodeveloper.mtn.com                      │   │
│  │                                                          │   │
│  │ Required Headers:                                        │   │
│  │ • Authorization: Bearer {access_token}                   │   │
│  │ • Ocp-Apim-Subscription-Key: {primary_key}              │   │
│  │ • X-Target-Environment: sandbox | production            │   │
│  │ • Content-Type: application/json                         │   │
│  │                                                          │   │
│  │ Endpoints:                                               │   │
│  │ • POST /collection/v1_0/token/                           │   │
│  │   - Get access token                                     │   │
│  │                                                          │   │
│  │ • POST /collection/v1_0/requesttopay                    │   │
│  │   - Initiate payment                                     │   │
│  │   - User gets USSD/App prompt                            │   │
│  │                                                          │   │
│  │ • GET /collection/v1_0/requesttopay/{transactionId}     │   │
│  │   - Check payment status                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
           │                                        △
           │ Request sent to user's phone          │ MTN returns
           │ User receives USSD/App prompt        │ Payment status
           ↓                                        │
┌─────────────────────────────────────────────────────────────────┐
│                    USER'S PHONE DEVICE                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ MTN MoMo USSD/Mobile App                                 │   │
│  │                                                          │   │
│  │ User sees: "Pay 50,000 XOF for rent?"                   │   │
│  │ User enters: PIN to confirm                              │   │
│  │ User sees: "Payment successful"                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
           │                                        △
           │ Payment confirmed                     │ MTN API
           │ MTN processes                         │ confirms
           ↓                                        │
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Table: tenant_payments                                   │   │
│  │ ├─ id (primary key)                                      │   │
│  │ ├─ tenant_id (who's paying)                              │   │
│  │ ├─ apartment_id (which unit)                             │   │
│  │ ├─ amount (how much)                                     │   │
│  │ ├─ status (pending → completed)                          │   │
│  │ ├─ transaction_id (MTN transaction ID)                   │   │
│  │ ├─ phone_number (payment from)                           │   │
│  │ ├─ mtn_reference_code (MTN reference)                    │   │
│  │ ├─ payment_gateway ('mtn_momo')                          │   │
│  │ ├─ payment_date (when paid)                              │   │
│  │ ├─ due_date (deadline)                                   │   │
│  │ └─ created_at / updated_at                               │   │
│  │                                                          │   │
│  │ Table: mtn_momo_logs                                     │   │
│  │ ├─ id (primary key)                                      │   │
│  │ ├─ payment_id (link to payment)                          │   │
│  │ ├─ request_type (request_to_pay, get_status)            │   │
│  │ ├─ request_body (what we sent)                           │   │
│  │ ├─ response_body (what we got back)                      │   │
│  │ ├─ http_status_code (200, 400, 500, etc.)               │   │
│  │ ├─ error_message (if any)                                │   │
│  │ └─ created_at                                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
           △
           │ UPDATE/SELECT
           │ Write results
           │
Back to Frontend → Auto-refresh dashboard
```

---

## 🔄 Request/Response Flow

### Payment Initiation

```
Browser:
  POST /api/payments/mtn-momo
  {
    paymentId: 123,
    phoneNumber: "+256789123456",
    amount: 50000,
    tenantId: "user-001"
  }
        ↓
Server:
  1. Validate inputs
  2. Get access token from MTN
  3. Call MTN requestToPay API
        ↓
MTN API:
  Sends USSD prompt to user's phone
  Waits for user response
        ↓
Response back to browser:
  {
    "success": true,
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "message": "Payment request sent to phone"
  }
        ↓
Browser:
  Shows message + starts checking status
```

### Status Checking (Auto Every 3 Seconds)

```
Browser:
  GET /api/payments/mtn-momo?transactionId=550e8400...&paymentId=123
        ↓
Server:
  1. Call MTN getTransactionStatus API
  2. Get response: PENDING or SUCCESSFUL
  3. If SUCCESSFUL: Update database 
        ↓
MTN API:
  Returns payment status
        ↓
Response back to browser:
  {
    "transactionId": "550e8400...",
    "status": "SUCCESSFUL",
    "financial_transaction_id": "MTN-123-XYZ"
  }
        ↓
Browser:
  Updates UI from "pending" to "completed ✅"
```

---

## 📋 Configuration Layers

```
ENVIRONMENT CONFIGURATION
│
├─ .env.local (File system)
│  ├─ MTN_MOMO_PRIMARY_KEY
│  ├─ MTN_MOMO_SECONDARY_KEY
│  ├─ MTN_MOMO_API_USER_ID
│  ├─ MTN_MOMO_API_KEY
│  ├─ MTN_MOMO_SUBSCRIPTION_KEY
│  └─ NEXT_PUBLIC_APP_URL
│
├─ .env (Git-ignored)
│  └─ Loaded at runtime
│
└─ Vercel Dashboard (Production)
   └─ Same variables configured
```

---

## 🔐 Security Layers

```
LAYER 1: Credential Storage
├─ API Keys: Server-side only (.env.local)
├─ Public Key: Can be exposed (NEXT_PUBLIC_*)
└─ Secret Key: Never in frontend

LAYER 2: Authentication
├─ Header: Authorization: Bearer {token}
├─ Token: Requested fresh for each payment
└─ Expiry: Token auto-refreshes

LAYER 3: Request Validation
├─ Input: Validate phone, amount, IDs
├─ Headers: Include proper auth headers
└─ Payload: Encrypted in transit (HTTPS)

LAYER 4: Database Security
├─ RLS: Row-level policies enabled
├─ Audit: All transactions logged
└─ Access: Only authenticated users

LAYER 5: Logging & Monitoring
├─ Logs: mtn_momo_logs table
├─ Tracking: Transaction IDs unique
└─ Alerts: Monitor for errors
```

---

## 🧮 Data Models

### Payment Record

```typescript
interface TenantPayment {
  id: number;                    // Primary key
  tenant_id: string;             // Who's paying
  apartment_id: number;          // Which apartment
  amount: decimal(10, 2);        // How much (50000.00)
  status: varchar(20);           // pending | completed | failed
  payment_method: varchar(50);   // mtn_momo | bank_transfer
  payment_gateway: varchar(50);  // 'mtn_momo'
  transaction_id: varchar(255);  // MTN transaction ID (unique)
  phone_number: varchar(20);     // Payment source phone (+256...)
  mtn_reference_code: varchar;   // MTN reference number
  payment_date: date;            // When paid
  due_date: date;                // Deadline
  reference_number: varchar(100);// Invoice/reference
  currency: varchar(3);          // XOF, etc.
  created_at: timestamp;         // Record creation
  updated_at: timestamp;         // Last update
}
```

### Transaction Log Entry

```typescript
interface MTNMoMoLog {
  id: number;                    // Primary key
  payment_id: number;            // Link to payment
  request_type: varchar(50);     // request_to_pay | get_status
  request_body: jsonb;           // What was sent
  response_body: jsonb;          // What came back
  http_status_code: integer;     // 200, 400, 500
  error_message: text;           // Error details
  created_at: timestamp;         // When logged
}
```

---

## 🌐 API Endpoints Summary

### POST /api/payments/mtn-momo

**Purpose:** Initiate payment request

**Request:**
```json
{
  "paymentId": 123,
  "phoneNumber": "+256789123456",
  "amount": 50000,
  "tenantId": "user-001"
}
```

**Response:**
```json
{
  "success": true,
  "transactionId": "uuid-here",
  "message": "Payment request sent to phone"
}
```

**Errors:**
- 400: Missing required fields
- 500: MTN API error, database error

---

### GET /api/payments/mtn-momo?transactionId=xxx&paymentId=123

**Purpose:** Check payment status

**Query Parameters:**
- `transactionId` - MTN transaction ID (required)
- `paymentId` - Database payment ID (optional)

**Response:**
```json
{
  "transactionId": "uuid-here",
  "status": "SUCCESSFUL|PENDING|FAILED",
  "financial_transaction_id": "MTN-ref-code"
}
```

**Errors:**
- 400: Missing transactionId
- 500: MTN API error

---

## 📊 Data Flow Example

### Complete Payment Flow

```
Tenant clicks "Pay Now"
    ↓ enters: +256789123456 for 50,000 XOF
    ↓ clicks: "Request Payment"
    ↓
[1] Browser sends POST to /api/payments/mtn-momo
    ├─ API validates input
    ├─ Calls: mtnMomoService.getAccessToken()
    │  └─ Gets: "Bearer abc123xyz..."
    ├─ Calls: mtnMomoService.requestToPay()
    │  ├─ Sends: POST to MTN API
    │  ├─ MTN: Sends prompt to +256789123456
    │  └─ Returns: transactionId
    ├─ Updates: tenant_payments table
    │  └─ Sets: transaction_id, status='pending'
    ├─ Logs: Entry in mtn_momo_logs
    └─ Returns: { transactionId, status: 'pending' }
    ↓
[2] Browser receives transactionId
    ├─ Displays: "Check your phone for prompt"
    ├─ Starts: Auto-checking status every 3 seconds
    └─ Shows: "Checking... Please confirm on your phone"
    ↓
[3] User's phone gets USSD prompt
    ├─ Shows: "Confirm payment of 50,000 XOF?"
    ├─ User: Enters PIN
    └─ MTN: Processes transaction
    ↓
[4] Browser GET /api/payments/mtn-momo?transactionId=xxx
    ├─ API calls: mtnMomoService.getTransactionStatus()
    │  ├─ Sends: GET to MTN API
    │  └─ Returns: { status: 'SUCCESSFUL', ... }
    ├─ Updates: tenant_payments.status = 'completed'
    ├─ Logs: New entry in mtn_momo_logs
    └─ Returns: { status: 'SUCCESSFUL', ... }
    ↓
[5] Browser receives success response
    ├─ Updates: Widget from pending → completed
    ├─ Shows: "Payment successful! ✅"
    ├─ Displays: Transaction ID & reference code
    └─ Calls: onSuccess() callback
    ↓
[6] Dashboard refreshes
    ├─ Fetches: Updated tenant_payments
    ├─ Shows: Payment marked as completed
    ├─ Updates: Summary stats
    └─ Shows: Green checkmark on payment
```

---

## 🎯 Integration Points

| Component | Integrates With | Method | Purpose |
|-----------|-----------------|--------|---------|
| Widget | API Route | POST/GET | Send & check payments |
| API Route | Service | Call methods | Business logic |
| Service | MTN API | HTTPS | External requests |
| API Route | Supabase | Query/Update | Store data |
| Dashboard | Supabase | Select | Fetch payment list |
| Dashboard | Widget | Props | Display & handle |

---

## 🔧 Customization Points

### Change Status Check Interval

```typescript
// In MTNMoMoPaymentWidget.tsx:
useEffect(() => {
  const interval = setInterval(() => {
    checkPaymentStatus();
  }, 3000);  // ← Change this (milliseconds)
  
  return () => clearInterval(interval);
}, [transactionId]);
```

### Change Phone Format

```typescript
// In mtn-momo-service.ts:
private formatPhoneNumber(phoneNumber: string): string {
  // Change country code from 256 to yours
  if (cleaned.startsWith('0')) {
    cleaned = '256' + cleaned.substring(1);  // ← Your code
  }
}
```

### Change Currency

```typescript
// In mtn-momo-service.ts:
currency: 'XOF'  // ← Change to your currency

// In API request:
currency: 'UGX'  // Uganda
currency: 'XAF'  // Cameroon
currency: 'ZWL'  // Zimbabwe
```

---

## 📈 Scalability

### Current Capacity

- **Concurrent Users:** Hundreds
- **Daily Transactions:** Thousands
- **Database:** Scales with Supabase
- **API Calls:** Rate-limited by MTN

### When to Scale

```
If you exceed:
├─ 1000 concurrent users → Ask Supabase for resources
├─ 10000 daily payments → Add caching layer
├─ 100 per second → Implement queue system
└─ Hit rate limits → Contact MTN business
```

---

## 🚀 Deployment Architecture

### Local Development

```
.env.local (sandbox) → Localhost → Supabase Dev → MTN Sandbox
```

### Production

```
Vercel Env Vars (production) → vercel.com → Supabase Prod → MTN Prod
```

### Environment Progression

```
Development
↓ (test with mock service)
Staging  
↓ (test with sandbox credentials)
Production
→ (use real credentials + real phone numbers)
```

---

## 📊 Monitoring & Observability

### Key Metrics to Track

```
✓ Total payments received
✓ Payment success rate
✓ Average processing time
✓ Failed payment reasons
✓ API error rates
✓ Database response times
✓ User device types
✓ Peak usage times
```

### Queries for Monitoring

```sql
-- Success rate today
SELECT 
  COUNT(*) total,
  SUM(CASE WHEN status='completed' THEN 1 END) successful,
  ROUND(100.0 * SUM(CASE WHEN status='completed' THEN 1 END)::numeric / COUNT(*), 2) rate
FROM tenant_payments
WHERE created_at::date = TODAY();

-- Error tracking
SELECT 
  error_message,
  COUNT(*) occurrences
FROM mtn_momo_logs
WHERE http_status_code >= 400
GROUP BY error_message
ORDER BY occurrences DESC;

-- Slow requests
SELECT 
  request_type,
  AVG(EXTRACT(EPOCH FROM (created_at - created_at))) as avg_time
FROM mtn_momo_logs
GROUP BY request_type;
```

---

**Architecture Diagram End**

For more details, see `MTN_MOMO_SETUP.md` and `MTN_MOMO_INTEGRATION_SUMMARY.md`.
