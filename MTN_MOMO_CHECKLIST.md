# MTN MoMo Integration Checklist

Quick reference for setting up MTN MoMo payments.

## 🏗️ Setup Phase

- [ ] **Register at MTN MoMo Developer Portal**
  - Go to: https://momodeveloper.mtn.com
  - Create account
  - Verify email

- [ ] **Subscribe to Collections API**
  - Navigate to Products > Collections
  - Click Subscribe
  - Accept terms

- [ ] **Get Primary & Secondary Keys**
  - Go to Dashboard > Subscriptions
  - Copy Primary Key
  - Copy Secondary Key

- [ ] **Update .env.local**
  ```env
  MTN_MOMO_PRIMARY_KEY=your-key
  MTN_MOMO_SECONDARY_KEY=your-key
  MTN_MOMO_SUBSCRIPTION_KEY=your-key
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```

## 🔑 API User Setup

- [ ] **Create API User**
  - Option A: Use automatic setup script
  - Option B: Create manually in MTN dashboard

- [ ] **Get API User ID**
  - Save to `.env.local`

- [ ] **Generate API Key**
  - Save to `.env.local`

- [ ] **Verify Credentials**
  ```env
  MTN_MOMO_API_USER_ID=your-id
  MTN_MOMO_API_KEY=your-key
  ```

## 🗄️ Database Setup

- [ ] **Run Migration**
  ```sql
  -- Run scripts/016-add-mtn-momo-payments.sql
  -- Or sync with Supabase
  ```

- [ ] **Verify Tables Created**
  - `tenant_payments` updated with MTN MoMo columns
  - `mtn_momo_logs` table created

- [ ] **Test Database Connection**
  ```bash
  pnpm dev
  # Check for errors in console
  ```

## 🧪 Testing

- [ ] **Start Development Server**
  ```bash
  pnpm dev
  ```

- [ ] **Navigate to Payment Page**
  - Go to: http://localhost:3000/tenant/payments
  - Login as tenant if needed

- [ ] **Try Test Payment**
  - Create test payment record (via admin)
  - Click "Pay Now with MTN MoMo"
  - Enter test phone number
  - Confirm payment

- [ ] **Check Logs**
  ```sql
  SELECT * FROM mtn_momo_logs ORDER BY created_at DESC;
  SELECT * FROM tenant_payments WHERE transaction_id IS NOT NULL;
  ```

- [ ] **Verify Payment Status Updates**
  - Payment should show as pending
  - After user confirms: status = completed

## 🚀 Production Setup

- [ ] **Get Production Credentials**
  - Request from MTN Business Support
  - Get production keys (different from sandbox)

- [ ] **Update Configuration**
  - [ ] Change endpoint from sandbox to production
  - [ ] Update Primary Key
  - [ ] Update API User ID
  - [ ] Update API Key
  - [ ] Change X-Target-Environment to "production"
  - [ ] Update NEXT_PUBLIC_APP_URL

- [ ] **Test Production Credentials**
  - [ ] Verify in sandbox first
  - [ ] Note: Use real phone numbers (will actually charge)

- [ ] **Deploy to Vercel/Hosting**
  - [ ] Add environment variables
  - [ ] Set SUPABASE_SERVICE_ROLE_KEY
  - [ ] Set all MTN_MOMO_* variables
  - [ ] Set NEXT_PUBLIC_APP_URL to domain
  - [ ] Deploy application

- [ ] **Verify Production**
  - [ ] Test payment with real scenario
  - [ ] Verify database updates
  - [ ] Check transaction logs
  - [ ] Monitor for errors

## 📊 Monitoring

- [ ] **Set Up Alerts**
  - Failed payments: Alert admin
  - High error rate: Alert developer
  - Large transactions: Review flagged

- [ ] **Regular Audits**
  - Review logs weekly
  - Check for declined payments
  - Verify all payments recorded
  - Monitor for fraud patterns

- [ ] **Backup Keys**
  - Store secondary key safely
  - Have rotation plan
  - Document key rotation dates

## 🔐 Security Checklist

- [ ] **Environment Variables**
  - [ ] Never commit .env.local
  - [ ] All sensitive keys server-side only
  - [ ] No keys in frontend code

- [ ] **Database Security**
  - [ ] RLS policies enabled
  - [ ] Proper access controls
  - [ ] Audit logs maintained

- [ ] **API Security**
  - [ ] HTTPS enforced
  - [ ] Rate limiting added (optional)
  - [ ] Input validation
  - [ ] Error messages don't leak info

- [ ] **Key Management**
  - [ ] Keys rotated every 90 days
  - [ ] Old keys deactivated
  - [ ] Access logged

## 📝 Code Review Checklist

Before deploying, verify:

- [ ] **MTN MoMo Service** (`lib/mtn-momo-service.ts`)
  - [ ] Phone number formatting correct
  - [ ] Error handling proper
  - [ ] All endpoints implemented

- [ ] **API Routes** (`app/api/payments/mtn-momo/route.ts`)
  - [ ] POST endpoint for payment initiation
  - [ ] GET endpoint for status checks
  - [ ] Proper error responses
  - [ ] Database updates logging

- [ ] **Frontend Component** (`components/MTNMoMoPaymentWidget.tsx`)
  - [ ] Phone input validation
  - [ ] Status auto-checking works
  - [ ] Error messages clear
  - [ ] Loading states visible

- [ ] **Payment Page** (`app/tenant/payments/page.tsx`)
  - [ ] Shows all payments
  - [ ] Can filter/sort
  - [ ] Integration with widget works
  - [ ] Summary stats accurate

## ✅ Final Verification

- [ ] All files created:
  - [ ] scripts/016-add-mtn-momo-payments.sql
  - [ ] lib/mtn-momo-service.ts
  - [ ] app/api/payments/mtn-momo/route.ts
  - [ ] components/MTNMoMoPaymentWidget.tsx
  - [ ] app/tenant/payments/page.tsx
  - [ ] MTN_MOMO_SETUP.md

- [ ] All dependencies installed:
  - [ ] uuid package

- [ ] Environment configured:
  - [ ] .env.local updated
  - [ ] All MTN_MOMO_* variables set
  - [ ] NEXT_PUBLIC_APP_URL set

- [ ] Database ready:
  - [ ] Migration applied
  - [ ] Tables created
  - [ ] Indexes created
  - [ ] RLS policies enabled

- [ ] Testing complete:
  - [ ] Sandbox testing done
  - [ ] Payments recorded correctly
  - [ ] Status updates work
  - [ ] Error handling works

- [ ] Documentation:
  - [ ] MTN_MOMO_SETUP.md reviewed
  - [ ] Team trained on system
  - [ ] Runbooks created
  - [ ] Support contacts documented

---

**Status:** Ready to Deploy ✅

**Notes:**
- Keep this checklist updated
- Track completion dates
- Review monthly
- Update for any changes
