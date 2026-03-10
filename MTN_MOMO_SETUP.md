# MTN MoMo Payment Integration Guide

## Overview

This guide shows how to integrate MTN MoMo payment system into your tenant dashboard. MTN MoMo is a mobile money service that allows users to make payments using their phone number.

## Prerequisites

✅ **Already Set Up:**
- Node.js/Next.js backend
- Supabase database
- Tenant dashboard with authentication
- TypeScript support

✅ **New Dependencies Added:**
- `uuid` - for generating unique transaction IDs

## Step 1: Create MTN MoMo Developer Account

1. **Go to MTN MoMo Developer Portal**
   - Visit: https://momodeveloper.mtn.com
   - Sign up for a free account

2. **Subscribe to Collections API**
   - Navigate to Products > Collections API
   - Click "Subscribe"
   - Accept terms and conditions

3. **Get Your Keys**
   - Go to Dashboard > Subscriptions
   - Find Collections API subscription
   - Copy your:
     - **Primary Key** (subscription key)
     - **Secondary Key** (backup key)

## Step 2: Configure Environment Variables

Create or update your `.env.local` file in the root directory:

```env
# MTN MoMo Configuration
MTN_MOMO_PRIMARY_KEY=your-primary-key-from-momo-dashboard
MTN_MOMO_SECONDARY_KEY=your-secondary-key-from-momo-dashboard
MTN_MOMO_SUBSCRIPTION_KEY=your-primary-key-from-momo-dashboard

# Your API User ID (see Step 3)
MTN_MOMO_API_USER_ID=your-api-user-id

# Your API Key (see Step 3)
MTN_MOMO_API_KEY=your-api-key

# Your application URL (for callbacks)
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Use your actual domain in production
```

## Step 3: Create API User & API Key

The MTN MoMo API requires an API User and API Key. You have two options:

### Option A: Automatic Setup (Recommended)

1. Create a temporary Node.js script:

```bash
# Create temp file
echo 'import { mtnMomoService } from "./lib/mtn-momo-service.js"; async function setup() { const result = await mtnMomoService.createApiUser(); console.log("API User:", result.api_user); console.log("API Key:", result.api_key); } setup();' > setup-momo.mjs
```

2. Run it with proper environment:
```bash
source .env.local && node setup-momo.mjs  # Linux/Mac
# Or manually set the variables on Windows PowerShell
$env:MTN_MOMO_PRIMARY_KEY="your-key"
node setup-momo.mjs
```

3. Note the output values and update your `.env.local`

### Option B: Manual Setup via MTN Dashboard

1. Go to MTN MoMo Dashboard > Users
2. Create new API User
3. Generate API Key
4. Update `.env.local` with these values

## Step 4: Update Database Schema

The database already includes payment tracking. Apply the migration to add MTN MoMo specific fields:

```bash
# Run this SQL in your Supabase dashboard
# Execute the script from: scripts/016-add-mtn-momo-payments.sql
```

Or run via Supabase CLI:
```bash
supabase migration up
```

**New columns added to `tenant_payments`:**
- `transaction_id` - MTN MoMo transaction ID
- `mtn_reference_code` - MTN MoMo reference code
- `phone_number` - Customer's phone number
- `payment_gateway` - Set to 'mtn_momo'
- `currency` - Currency code (XOF, etc.)

**New table: `mtn_momo_logs`**
- Tracks all API requests/responses
- Useful for debugging and auditing

## Step 5: Understand the Integration

### Architecture Overview

```
Tenant Dashboard
    ↓
MTNMoMoPaymentWidget (Frontend Component)
    ↓
/api/payments/mtn-momo (API Route)
    ↓
MTNMoMoService (Backend Service)
    ↓
MTN MoMo API (External)
    ↓
User's Phone (MoMo Prompt)
    ↓
Supabase (Payment Recording)
```

### Key Components

**1. MTNMoMoPaymentWidget.tsx**
- Frontend component for payment UI
- Handles phone number input
- Shows payment status
- Auto-checks status every 3 seconds

**2. mtn-momo-service.ts**
- Core service for MTN MoMo API
- Methods:
  - `getAccessToken()` - Get auth token
  - `requestToPay()` - Initiate payment
  - `getTransactionStatus()` - Check payment status
  - `createApiUser()` - Create new API user (setup only)

**3. /api/payments/mtn-momo/route.ts**
- Backend API endpoints
- POST - Initiate payment
- GET - Check payment status
- Handles database updates and logging

**4. tenant/payments/page.tsx**
- Tenant-facing payment dashboard
- Shows payment history
- Displays pending and completed payments
- Integrates MTNMoMoPaymentWidget

## Step 6: Integrate into Your Tenant Dashboard

The payment page is already created at `/tenant/payments`:

```typescript
// Access at: http://localhost:3000/tenant/payments

// Features:
- View all pending payments
- View payment history
- Pay with MTN MoMo
- Check payment status
- View summary statistics
```

### Add Link to Navigation

Update your tenant navigation to link to payments:

```tsx
<Link href="/tenant/payments">
  <Icon />
  Payments
</Link>
```

## Step 7: Test the Integration

### Testing in Sandbox Mode

By default, the integration uses MTN MoMo **Sandbox** (test environment).

```bash
# 1. Start development server
pnpm dev

# 2. Navigate to http://localhost:3000/tenant/payments

# 3. Create a test payment (if needed):
# - Admin adds pending payment for tenant

# 4. Click "Pay Now with MTN MoMo"

# 5. Enter a test phone number:
#    Format: +256789123456 or 0789123456
#    (Exact numbers depend on your region)

# 6. Confirm payment

# 7. Check logs in Supabase:
# - SELECT * FROM mtn_momo_logs;
# - SELECT * FROM tenant_payments WHERE transaction_id IS NOT NULL;
```

### Test Phone Numbers (Sandbox)

Contact MTN MoMo support for test credentials. Common formats:
- Uganda: +256700000000
- Cameroon: +237671234567
- Other regions: Check your country code

### Troubleshooting Tests

**Issue: "Invalid subscription key"**
- ✓ Check `.env.local` has correct PRIMARY_KEY
- ✓ Verify subscription is active in MTN dashboard

**Issue: "API User creation failed"**
- ✓ Use primary key for subscription key
- ✓ Check network connectivity
- ✓ Verify NEXT_PUBLIC_APP_URL is set

**Issue: "Payment request fails"**
- ✓ Ensure API User ID and API Key are set
- ✓ Test phone number is valid format
- ✓ Check account has sufficient permissions

## Step 8: Production Deployment

### Before Going Live

1. **Get Production Credentials**
   - MTN MoMo provides production keys
   - Usually different from sandbox keys
   - Request through MTN Business Support

2. **Update Environment**
   - Change `MTN_MOMO_PRIMARY_KEY` to production key
   - Update `MTN_MOMO_API_USER_ID` and `MTN_MOMO_API_KEY` for production
   - Update `NEXT_PUBLIC_APP_URL` to your domain

3. **Change API Endpoint** (in mtn-momo-service.ts)
   ```typescript
   // Change from sandbox:
   const MOMO_BASE_URL = 'https://sandbox.momodeveloper.mtn.com';
   
   // To production:
   const MOMO_BASE_URL = 'https://api.momodeveloper.mtn.com';
   ```

4. **Update Environment Target** (in route.ts)
   ```typescript
   // Change from sandbox:
   'X-Target-Environment': 'sandbox',
   
   // To production:
   'X-Target-Environment': 'production',
   ```

5. **Deploy to Vercel/Hosting**
   ```bash
   # Add environment variables to Vercel dashboard:
   # Settings > Environment Variables
   
   MTN_MOMO_PRIMARY_KEY
   MTN_MOMO_SECONDARY_KEY
   MTN_MOMO_API_USER_ID
   MTN_MOMO_API_KEY
   MTN_MOMO_SUBSCRIPTION_KEY
   NEXT_PUBLIC_APP_URL
   ```

6. **Enable Webhook Notifications** (Optional)
   - MTN MoMo can send payment confirmation webhooks
   - Create endpoint: `/api/webhooks/mtn-momo`
   - Update callback URL in MTN dashboard

## API Reference

### Frontend Component

```tsx
import { MTNMoMoPaymentWidget } from '@/components/MTNMoMoPaymentWidget';

<MTNMoMoPaymentWidget
  paymentId={payment.id}           // Payment record ID
  amount={payment.amount}          // Amount to pay (in XOF)
  tenantId={tenant.id}             // Tenant ID
  onSuccess={(txnId) => {}}        // Success callback
  onError={(error) => {}}          // Error callback
/>
```

### Backend Service

```typescript
import { mtnMomoService } from '@/lib/mtn-momo-service';

// Get access token
const token = await mtnMomoService.getAccessToken();

// Request payment
const transactionId = await mtnMomoService.requestToPay(
  phoneNumber,  // e.g., "+256789123456"
  amount,       // e.g., 50000
  externalId,   // e.g., "PAYMENT-123"
  payerMessage, // Message shown to payer (optional)
  payeeNote     // Note for merchant (optional)
);

// Check status
const status = await mtnMomoService.getTransactionStatus(transactionId);
// Returns: { financial_transaction_id, status, reason? }
```

### Payment Statuses

- `PENDING` - Waiting for user confirmation
- `SUCCESSFUL` - Payment completed
- `FAILED` - Payment rejected or timed out

## Database Queries

### View All Payments

```sql
SELECT * FROM tenant_payments
ORDER BY created_at DESC;
```

### View Pending MTN MoMo Payments

```sql
SELECT * FROM tenant_payments
WHERE payment_gateway = 'mtn_momo' 
  AND status = 'pending'
ORDER BY due_date ASC;
```

### View Transaction Logs

```sql
SELECT * FROM mtn_momo_logs
ORDER BY created_at DESC
LIMIT 50;
```

### View Payment with Details

```sql
SELECT 
  tp.*,
  a.building_number,
  a.apartment_number,
  t.full_name
FROM tenant_payments tp
LEFT JOIN apartments a ON tp.apartment_id = a.id
LEFT JOIN tenants t ON tp.tenant_id = t.id
WHERE tp.transaction_id IS NOT NULL;
```

## Security Best Practices

✅ **Implemented:**
- API keys only stored in server-side `.env.local`
- Phone numbers hashed in logs
- Transaction IDs generated securely
- All requests validated
- HTTPS enforced in production

⚠️ **Additional Steps:**

1. **Rotate Keys Regularly**
   ```bash
   # Update MTN MoMo keys every 90 days
   # Update in .env.local and Vercel dashboard
   ```

2. **Monitor Logs**
   ```sql
   -- Check for suspicious activity
   SELECT * FROM mtn_momo_logs 
   WHERE http_status_code >= 400
   ORDER BY created_at DESC;
   ```

3. **Rate Limiting**
   ```typescript
   // Add rate limiting to API routes
   import { Ratelimit } from "@upstash/ratelimit";
   ```

4. **Audit Trail**
   - All transactions logged in `mtn_momo_logs`
   - Review regularly for suspicious patterns
   - Keep logs for compliance

## Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| "Missing subscription key" | Add `MTN_MOMO_PRIMARY_KEY` to `.env.local` |
| "Invalid API User ID" | Regenerate API User (Step 3) |
| "Phone number rejected" | Use correct format: `+256...` or `0...` |
| "Payment stuck on pending" | Check logs, may be user hasn't confirmed |
| "Webhook not received" | Configure webhook endpoint in MTN dashboard |

### Check Logs

```bash
# View recent MTN MoMo API calls
# In Supabase: 
SELECT * FROM mtn_momo_logs ORDER BY created_at DESC LIMIT 20;

# Check for errors
SELECT * FROM mtn_momo_logs 
WHERE response_body ->> 'error' IS NOT NULL;
```

## Next Steps

1. ✅ Configure environment variables
2. ✅ Create API User and API Key
3. ✅ Test in sandbox
4. ✅ Deploy to production
5. ✅ Monitor payments and logs
6. Optional: Set up webhook notifications
7. Optional: Add SMS confirmations
8. Optional: Integrate with email receipts

## Support & Resources

- **MTN MoMo Docs:** https://momodeveloper.mtn.com/docs
- **API Reference:** https://momodeveloper.mtn.com/docs/getting-started
- **Sandbox Testing:** https://momodeveloper.mtn.com/docs/sandbox
- **Community:** Check MTN MoMo forums and GitHub

## Files Modified/Created

```
✨ New Files:
- scripts/016-add-mtn-momo-payments.sql
- lib/mtn-momo-service.ts
- app/api/payments/mtn-momo/route.ts
- components/MTNMoMoPaymentWidget.tsx
- app/tenant/payments/page.tsx

📝 Updated Files:
- ENV_EXAMPLE.md (added MTN MoMo variables)
- package.json (added uuid dependency)
```

---

**Version:** 1.0.0 | **Last Updated:** March 9, 2026
