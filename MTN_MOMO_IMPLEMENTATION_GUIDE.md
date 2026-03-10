# MTN MoMo Complete Implementation Guide

## Overview

This document explains the complete MTN MoMo payment integration including credential management, access token generation, request-to-pay processing, and payment status checking.

---

## 1. Credential Management

### Required Credentials

Your implementation requires **three critical credentials** from the [MTN MoMo Developer Portal](https://momodeveloper.mtn.com/):

| Credential | Source | Format | Purpose |
|-----------|--------|--------|---------|
| `MTN_MOMO_PRIMARY_KEY` | Developer Dashboard | 32+ hex characters | Subscription key for API authentication |
| `MTN_MOMO_API_USER_ID` | API Settings → Create API User | UUID (36 chars) | Identifies your API user for token generation |
| `MTN_MOMO_API_KEY` | API User Settings | 40+ character string | Secret key for access token generation |

### Setting Up Credentials

#### Step 1: Get Primary Key
1. Go to https://momodeveloper.mtn.com/
2. Sign up and create your business account
3. In Dashboard → API Keys, copy your **Primary Key**
4. Add to `.env.local`:
   ```
   MTN_MOMO_PRIMARY_KEY=your-primary-key-here
   ```

#### Step 2: Generate API User and Key
1. In Developer Portal → API Settings
2. Click "Create API User"
3. A UUID will be generated (your `MTN_MOMO_API_USER_ID`)
4. Click "Generate API Key" to get your `MTN_MOMO_API_KEY`
5. Add to `.env.local`:
   ```
   MTN_MOMO_API_USER_ID=550e8400-e29b-41d4-a716-446655440000
   MTN_MOMO_API_KEY=your-40-character-api-key-here
   ```

### Configuration Variables

```env
# CRITICAL: Replace with actual values from MTN portal
MTN_MOMO_PRIMARY_KEY=your-primary-key
MTN_MOMO_API_USER_ID=your-uuid-here
MTN_MOMO_API_KEY=your-api-key-here

# Optional: Secondary key for failover
MTN_MOMO_SECONDARY_KEY=your-secondary-key

# Optional: Subscription key (defaults to PRIMARY_KEY)
MTN_MOMO_SUBSCRIPTION_KEY=your-subscription-key

# Environment: 'sandbox' for testing, 'production' for live
MTN_MOMO_ENVIRONMENT=sandbox

# Currency code (ISO 4217)
# XOF = West African CFA franc
# USD = US Dollar
# Others: EUR, GBP, etc.
MTN_MOMO_CURRENCY=XOF

# Country code (without +) for phone number formatting
# 256 = Uganda, 212 = Morocco, 251 = Ethiopia, etc.
MTN_MOMO_COUNTRY_CODE=256

# Your app's public URL (for callbacks)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Validation

Use the validation endpoint to check your configuration:

```bash
# Check configuration
curl http://localhost:3000/api/payments/mtn-momo/validate

# Test credentials (attempts actual token generation)
curl -X POST http://localhost:3000/api/payments/mtn-momo/validate
```

---

## 2. Access Token Generation

### How It Works

The MTN MoMo API requires an access token for each request. This token is obtained using **HTTP Basic Authentication**:

```
Authorization: Basic base64(API_USER_ID:API_KEY)
```

### Implementation Details

**File:** `lib/mtn-momo-service.ts`
**Method:** `getAccessToken()`

```typescript
async getAccessToken(): Promise<string> {
  // Step 1: Create Basic Auth header
  const auth = Buffer.from(
    `${this.apiUserId}:${this.apiKey}`
  ).toString('base64');

  // Step 2: Send POST request to token endpoint
  const response = await fetch(
    `${baseUrl}/collection/v1_0/token/`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        'Content-Type': 'application/json',
      },
    }
  );

  // Step 3: Extract and return access token
  const data = await response.json();
  return data.access_token;
}
```

### Request Example

```http
POST https://sandbox.momodeveloper.mtn.com/collection/v1_0/token/
Authorization: Basic ZGMzM2NhYTUtOTgyYy00ZDI1LWIwYjQtZWM2YWRhYzEwZWM1OnlvdXItYXBpLWtleS1oZXJl
Ocp-Apim-Subscription-Key: 2bf2f13307cf4d87b31eca790b592407
Content-Type: application/json
```

### Response Example

```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

---

## 3. Request-to-Pay Processing

### How It Works

Once you have an access token, you can initiate a payment request using the Bearer token:

```
Authorization: Bearer <ACCESS_TOKEN>
```

### Implementation Details

**File:** `lib/mtn-momo-service.ts`
**Method:** `requestToPay()`

```typescript
async requestToPay(
  phoneNumber: string,
  amount: number,
  externalId: string,
  payerMessage: string = 'Apartment rent payment',
  payeeNote: string = 'Payment received'
): Promise<string> {
  // Step 1: Get access token
  const accessToken = await this.getAccessToken();
  
  // Step 2: Generate unique reference ID for this transaction
  const transactionId = uuidv4();

  // Step 3: Send request-to-pay
  const response = await fetch(
    `${baseUrl}/collection/v1_0/requesttopay`,
    {
      method: 'POST',
      headers: {
        // Authorization: Bearer token (from step 1)
        'Authorization': `Bearer ${accessToken}`,
        // Subscription key for rate limiting
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        // Unique transaction reference (must be UUID)
        'X-Reference-Id': transactionId,
        // Target environment (sandbox or production)
        'X-Target-Environment': this.environment,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount.toString(),
        currency: this.currency,
        externalId: externalId,
        payer: {
          partyIdType: 'MSISDN',  // Phone number type
          partyId: this.formatPhoneNumber(phoneNumber),
        },
        payerMessage: payerMessage,
        payeeNote: payeeNote,
      }),
    }
  );

  // Step 4: Return transaction ID for status tracking
  return transactionId;
}
```

### Request Headers Explained

| Header | Value | Purpose |
|--------|-------|---------|
| `Authorization` | `Bearer <TOKEN>` | Authenticates the request with access token |
| `Ocp-Apim-Subscription-Key` | Primary Key | Enables rate limiting and API quota |
| `X-Reference-Id` | UUID | Unique identifier for this transaction |
| `X-Target-Environment` | sandbox\|production | Which environment to use |
| `Content-Type` | application/json | Request body format |

### Request Body

```json
{
  "amount": "1000",
  "currency": "XOF",
  "externalId": "PAYMENT-123",
  "payer": {
    "partyIdType": "MSISDN",
    "partyId": "+256789123456"
  },
  "payerMessage": "Apartment rent payment (Ref: 123)",
  "payeeNote": "Payment received"
}
```

### Response

```json
{
  "transactionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Note: 202 Accepted status means request was submitted. User will receive a prompt on their phone.

### API Endpoint Flow

```
User clicks "Pay with MTN MoMo"
       ↓
POST /api/payments/mtn-momo (with phoneNumber, amount)
       ↓
mtnMomoService.requestToPay()
       ↓
getAccessToken() → Basic Auth → Token endpoint
       ↓
requestToPay() → Bearer token → Collection API
       ↓
User receives prompt on phone
       ↓
User enters PIN to confirm
       ↓
Payment processed
```

---

## 4. Payment Status Checking

### How It Works

After initiating a payment, you must check its status periodically to determine if it was:
- **SUCCESSFUL**: User confirmed payment
- **FAILED**: User rejected or transaction failed
- **PENDING**: Awaiting user response

### Implementation Details

**File:** `lib/mtn-momo-service.ts`
**Method:** `getTransactionStatus()`

```typescript
async getTransactionStatus(transactionId: string): Promise<GetTransactionStatusResponse> {
  // Step 1: Get access token
  const accessToken = await this.getAccessToken();

  // Step 2: Check transaction status using GET request
  const response = await fetch(
    `${baseUrl}/collection/v1_0/requesttopay/${transactionId}`,
    {
      method: 'GET',
      headers: {
        // Authorization: Bearer token
        'Authorization': `Bearer ${accessToken}`,
        // Subscription key
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        // Target environment
        'X-Target-Environment': this.environment,
      },
    }
  );

  // Step 3: Parse and return status
  const data = await response.json();
  return data; // Contains status: SUCCESSFUL|FAILED|PENDING
}
```

### Response Format

```json
{
  "financial_transaction_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "SUCCESSFUL",
  "reason": null
}
```

For failed transactions:
```json
{
  "financial_transaction_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "FAILED",
  "reason": {
    "code": "INVALID_CALLBACK_URL_HOST",
    "message": "Invalid callback URL host"
  }
}
```

### Polling Strategy

Implement intelligent polling with retry logic:

```typescript
// Method: checkPaymentStatusWithRetry()
// Features:
// - Retries up to 10 times
// - 2-second delay between attempts
// - Stops on definitive result (SUCCESSFUL or FAILED)
// - Returns immediately for pending states

const status = await mtnMomoService.checkPaymentStatusWithRetry(
  transactionId,
  maxAttempts = 10,
  delayMs = 2000
);

if (status.status === 'SUCCESSFUL') {
  // Process successful payment
} else if (status.status === 'FAILED') {
  // Handle failed payment
} else {
  // Still pending
}
```

### Frontend Implementation

The `MTNMoMoPaymentWidget` component implements polling:

```typescript
useEffect(() => {
  if (!transactionId) return;

  // Check status every 3 seconds
  const interval = setInterval(() => {
    checkPaymentStatus();
  }, 3000);

  return () => clearInterval(interval);
}, [transactionId]);

const checkPaymentStatus = async () => {
  const response = await fetch(
    `/api/payments/mtn-momo?transactionId=${transactionId}&paymentId=${paymentId}`
  );
  const data = await response.json();

  if (data.status === 'SUCCESSFUL') {
    setSuccess(true);
    onSuccess?.(transactionId);
  } else if (data.status === 'FAILED') {
    setError('Payment failed. Please try again.');
  }
  // If PENDING, continue polling
};
```

---

## 5. Complete Payment Flow

### Sequence Diagram

```
┌─────────────┐         ┌──────────┐        ┌─────────────────┐
│ Tenant      │         │  Your    │        │ MTN MoMo API    │
│ (Frontend)  │         │  Server  │        │                 │
└─────────────┘         └──────────┘        └─────────────────┘
      │                       │                    │
      │ 1. Click "Pay"        │                    │
      ├──────────────────────>│                    │
      │                       │ 2. Get Token       │
      │                       │ Basic Auth (UUID:KEY)
      │                       ├───────────────────>│
      │                       │<──────────────────┤
      │                       │ Bearer Token       │
      │                       │                    │
      │                       │ 3. RequestToPay   │
      │                       │ (phone, amount)    │
      │                       ├───────────────────>│
      │                       │<──────────────────┤
      │<──────────────────────┤ TransactionID      │
      │ Payment initiated     │                    │
      │                       │                    │
      │ 4. Receives phone     │                    │
      │ prompt with PIN       │                    │
      │                       │                    │
      │ 5. Enters PIN         │                    │
      │ (on phone)            │                    │
      │                       │                    │
      │ 6. Check Status       │                    │
      ├──────────────────────>│ 7. Get Status      │
      │                       ├───────────────────>│
      │                       │<──────────────────┤
      │<──────────────────────┤ Status: SUCCESSFUL│
      │ Payment Complete! ✓   │                    │
      │                       │                    │
```

### Implementation Code

**Frontend (React Component)**
```typescript
// 1. User initiates payment
const handleInitiatePayment = async () => {
  const response = await fetch('/api/payments/mtn-momo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paymentId,
      phoneNumber,
      amount,
      tenantId,
    }),
  });
  const data = await response.json();
  setTransactionId(data.transactionId);
  // User receives prompt on phone
};

// 2. Poll for payment status
useEffect(() => {
  if (!transactionId) return;
  
  const interval = setInterval(async () => {
    const response = await fetch(
      `/api/payments/mtn-momo?transactionId=${transactionId}&paymentId=${paymentId}`
    );
    const status = await response.json();
    
    if (status.status === 'SUCCESSFUL') {
      onSuccess?.(transactionId);
      clearInterval(interval);
    }
  }, 3000);
  
  return () => clearInterval(interval);
}, [transactionId]);
```

**Backend (API Routes)**
```typescript
// POST /api/payments/mtn-momo
export async function POST(request: NextRequest) {
  const { phoneNumber, amount, paymentId, tenantId } = await request.json();
  
  // Validate credentials
  const validation = validateMTNMoMoCredentials();
  if (!validation.isValid) throw new Error('Missing credentials');
  
  // Get token and initiate payment
  const transactionId = await mtnMomoService.requestToPay(
    phoneNumber,
    amount,
    `PAYMENT-${paymentId}`,
    'Apartment rent payment',
    'Payment received'
  );
  
  // Save transaction ID
  await supabase.from('tenant_payments').update({
    transaction_id: transactionId,
    status: 'pending',
  }).eq('id', paymentId);
  
  return NextResponse.json({ transactionId });
}

// GET /api/payments/mtn-momo?transactionId=xxx
export async function GET(request: NextRequest) {
  const transactionId = request.nextUrl.searchParams.get('transactionId');
  
  // Check transaction status
  const status = await mtnMomoService.getTransactionStatus(transactionId);
  
  // Update payment record
  if (status.status === 'SUCCESSFUL') {
    await supabase.from('tenant_payments').update({
      status: 'completed',
      mtn_reference_code: status.financial_transaction_id,
    }).eq('id', paymentId);
  }
  
  return NextResponse.json({ status: status.status });
}
```

---

## 6. Testing & Validation

### Validate Configuration

```bash
# Check if credentials are configured
curl http://localhost:3000/api/payments/mtn-momo/validate

# Response (if valid):
{
  "configurationStatus": "valid",
  "environment": { "mode": "sandbox", "currency": "XOF" },
  "credentials": { "MTN_MOMO_API_USER_ID": "dc33****ec5" }
}
```

### Test Access Token Generation

```bash
# Test if credentials work
curl -X POST http://localhost:3000/api/payments/mtn-momo/validate

# Response (if credentials are valid):
{
  "success": true,
  "message": "Access token obtained successfully!",
  "tokenStatus": "valid"
}
```

### Test Payment Request

```bash
# Initiate a payment
curl -X POST http://localhost:3000/api/payments/mtn-momo \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": 1,
    "phoneNumber": "+256789123456",
    "amount": 50000,
    "tenantId": "tenant-1"
  }'

# Response:
{
  "success": true,
  "transactionId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Payment request sent to phone"
}
```

### Check Payment Status

```bash
# Check status
curl "http://localhost:3000/api/payments/mtn-momo?transactionId=550e8400-e29b-41d4-a716-446655440000&paymentId=1"

# Response:
{
  "success": true,
  "transactionId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PENDING",
  "message": "Payment is pending. Please wait for user confirmation."
}
```

---

## 7. Error Handling

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid phone number` | Format not recognized | Use format: +256789123456 |
| `Failed to get access token` | Wrong API credentials | Verify API_USER_ID and API_KEY |
| `Failed to request payment` | Authentication failed | Check all three keys are in .env.local |
| `Credentials are not configured` | Missing environment variables | Add all required keys to .env.local |
| `Invalid callback URL` | App URL not accessible | Set NEXT_PUBLIC_APP_URL correctly |

### Debug Mode

Enable logging by checking your server console:

```typescript
// All operations log detailed information:
console.log(`[MTN MoMo] Formatted phone number: ${phoneNumber} -> ${formatted}`);
console.log(`[MTN MoMo] Initiating payment: ${amount} ${currency} to ${phone}`);
console.log(`[MTN MoMo] Transaction status: ${transactionId} status: ${status}`);
```

---

## 8. Security Best Practices

1. **Store credentials in environment variables** (.env.local)
2. **Never commit .env.local** to version control
3. **Use server-side API routes** for sensitive operations
4. **Validate phone numbers** before sending to MTN API
5. **Log transactions** for audit trails
6. **Use HTTPS** in production
7. **Rotate API keys** periodically
8. **Monitor failed transactions** for suspicious activity

---

## Files Modified/Created

- ✅ `.env.local` - Updated with detailed credential setup
- ✅ `lib/mtn-momo-service.ts` - Enhanced with full implementation
- ✅ `lib/mtn-momo-credentials.ts` - NEW: Credential validation
- ✅ `app/api/payments/mtn-momo/route.ts` - Enhanced POST/GET handlers
- ✅ `app/api/payments/mtn-momo/validate/route.ts` - NEW: Validation endpoint

---

## Next Steps

1. **Get your credentials** from https://momodeveloper.mtn.com/
2. **Update .env.local** with all three required keys
3. **Restart your dev server** after adding credentials
4. **Validate configuration** using `/api/payments/mtn-momo/validate`
5. **Test a payment** using the MTN MoMo Payment Widget
6. **Switch to production** when ready (change environment variable)

---

## Support & Resources

- **MTN MoMo Developer Portal**: https://momodeveloper.mtn.com/
- **API Documentation**: https://momodeveloper.mtn.com/docs
- **Sandbox Environment**: Use for testing before going live
- **Production Environment**: Use for real transactions (after testing)

---

**Last Updated:** March 9, 2026
**Implementation Status:** ✓ Complete
**Ready for Testing:** Yes
