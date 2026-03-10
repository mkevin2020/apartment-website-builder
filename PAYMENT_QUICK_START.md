# Quick Start: Tenant Payment Feature

## 🎯 What Changed?

Your tenant dashboard now has a **"Make a Payment"** feature directly integrated. Tenants can now:

1. ✅ See all pending payments in one place
2. ✅ Select a payment to pay
3. ✅ Enter their MTN phone number
4. ✅ Make payment instantly via MTN MoMo
5. ✅ See real-time payment status updates

## 📍 Where Is It Located?

**Dashboard Location:** Right column, at the top (above "Quick Actions")

```
TENANT DASHBOARD
════════════════════════════════════════════════════════════════
                                    
Welcome back, [Tenant Name]! 👋                                 
                                    
═══════════════════════════════════════════════════════════════  
                                    
  ⚠️  You have 2 pending payments. See the payment section on   
      the right to make a payment.                              
                                    
═══════════════════════════════════════════════════════════════  
                                    
 MAIN CONTENT (2/3 width)    │  PAYMENT & ACTIONS (1/3 width)   
                             │                                  
 • Your Apartment Details     │  ┌──────────────────────────┐   
 • Lease Information          │  │  💳 PENDING PAYMENTS     │   
 • Available Apartments       │  ├──────────────────────────┤   
                             │  │ Total: 2,400 XOF         │   
 (Can book more apartments)  │  │                          │   
                             │  │ [Payment #REF-001]       │   
                             │  │  1,500 XOF - OVERDUE     │   
                             │  │                          │   
                             │  │ [Payment #REF-002] ✓     │   
                             │  │  900 XOF - PENDING       │   
                             │  │  Select payment above ⬆️  │   
                             │  │                          │   
                             │  │ Phone: [250XXXXXXXXX   ] │   
                             │  │                          │   
                             │  │ [Pay 900 XOF]            │   
                             │  │ Secure MTN MoMo payment  │   
                             │  └──────────────────────────┘   
                             │                                  
                             │  ┌──────────────────────────┐   
                             │  │  🚀 QUICK ACTIONS        │   
                             │  ├──────────────────────────┤   
                             │  │ • Make Payment           │   
                             │  │ • My Booked Apartments   │   
                             │  │ • View Apartments        │   
                             │  │ • View Profile           │   
                             │  │ • Payment History        │   
                             │  │ • Request Maintenance    │   
                             │  │ • Download Contract      │   
                             │  └──────────────────────────┘   
                             │                                  
                             │  ┌──────────────────────────┐   
                             │  │  📞 CONTACT INFO         │   
                             │  ├──────────────────────────┤   
                             │  │ Name: John Doe           │   
                             │  │ Email: john@example.com  │   
                             │  │ Phone: 250XXXXXXXXX      │   
                             │  └──────────────────────────┘   
```

## 🎬 Payment Flow

```
Step 1: Dashboard Opens
  ↓
See Pending Payments Alert at Top
  ↓
Payment Widget Shows in Right Column
  ↓
Select Payment to Pay ← Click on payment
  ↓
Enter MTN Phone Number ← Type phone
  ↓
Click "Pay [Amount] XOF" ← Submit
  ↓
System Initiates Payment via MTN
  ↓
Receive Payment Prompt on Phone ← Confirm on phone
  ↓
System Checks Status Every 3 Seconds
  ↓
Payment Confirmed ✓
  ↓
Success Message Appears
  ↓
Page Auto-Refreshes ← Payment marked as paid
  ↓
Dashboard Updated with Payment Paid
```

## 🚀 How Tenants Use It

### Step-by-Step:

1. **Login to Dashboard**
   - Go to `http://yoursite.com/tenant/dashboard`
   - See "You have X pending payment(s)" banner

2. **Find Payment Widget**
   - Scroll to right column
   - See "💳 Pending Payments" card
   - Shows total amount due

3. **Select Payment**
   - Click on the payment you want to pay
   - Payment gets blue border (selected)
   - Shows: Reference number, due date, amount, status

4. **Enter Phone Number**
   - Click phone input field
   - Type your MTN phone number
   - Format: `250XXXXXXXXX` or `+250XXXXXXXXX`

5. **Make Payment**
   - Click blue "Pay [Amount] XOF" button
   - Wait for "Payment Initiated" message
   - Check your phone for MTN payment prompt

6. **Confirm on Phone**
   - You'll get a notification on your MTN phone
   - Enter your PIN to confirm payment
   - Payment is processed

7. **Payment Confirmed**
   - Widget shows "Payment Successful!" ✓
   - Transaction ID displayed for reference
   - Page auto-refreshes
   - Payment now shows as "Paid"

## 💾 Data Stored

For each payment, the system stores:
- ✅ Transaction ID (from MTN)
- ✅ Payment ID
- ✅ Amount paid
- ✅ Date of payment
- ✅ Phone number used
- ✅ Payment status
- ✅ Tenant ID

## 🔄 Payment Status Flow

```
Payment Initiated → Pending → Confirmation Received → Successful ✓
                        ↓
                   (if declined)
                        ↓
                     Failed ✗
                        ↓
                  User Can Retry
```

## 🎨 Visual States

### 1. **Normal State** (Pending Payment)
```
┌─────────────────────────────┐
│ Payment #REF-001 - OVERDUE  │  ← Payment not selected
│ Due: March 15, 2026         │
│              1,500 XOF      │
└─────────────────────────────┘
```

### 2. **Selected State** (User clicked)
```
┌─────────────────────────────┐
│ Payment #REF-001 - PENDING  │  ← Selected (blue border)
│ Due: March 20, 2026         │
│                900 XOF      │  ← Real-time update
└─────────────────────────────┘
```

### 3. **Processing State**
```
⏳ Payment Initiated
   Transaction ID: abc123def456
   Status: Pending...
   
[Waiting for payment confirmation...]
```

### 4. **Success State** ✓
```
✅ Payment Successful!
   Transaction ID: abc123def456
   Amount: 900 XOF
   
Your payment has been received. You will 
receive a confirmation email shortly.

[Make Another Payment] [Back to Dashboard]
```

### 5. **Error State** ✗
```
❌ Payment Failed

Please enter your phone number

[Try Again] [Select Different Payment]
```

## ⚙️ What Developers Need to Know

### Files Changed:
1. **NEW**: `components/TenantPaymentWidget.tsx`
   - New component for payment interface
   - Handles payment state, API calls, status checking
   - Fully self-contained and reusable

2. **UPDATED**: `app/tenant/dashboard/page.tsx`
   - Added TenantPaymentWidget import
   - Added payment widget to right column
   - Updated pending payments alert

### Component Props:
```typescript
<TenantPaymentWidget
  pendingPayments={pendingPayments}     // Array of payments
  tenantId={tenant.id}                  // Tenant ID
  onPaymentSuccess={handleSuccess}      // Optional callback
/>
```

### API Endpoints Used:
```
POST /api/payments/mtn-momo
GET /api/payments/mtn-momo

(Already existed, no changes needed)
```

### Environment Variables Required:
```
MTN_MOMO_PRIMARY_KEY
MTN_MOMO_API_USER_ID
MTN_MOMO_API_KEY
MTN_MOMO_SUBSCRIPTION_KEY
MTN_MOMO_ENVIRONMENT=sandbox
MTN_MOMO_CURRENCY=XOF
MTN_MOMO_COUNTRY_CODE=250
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

## 📊 Success Metrics

- ✅ Payment widget visible when payments exist
- ✅ Users can select payments
- ✅ Users can enter phone number
- ✅ Payments initiate successfully
- ✅ Status updates in real-time
- ✅ Successful payments refresh page
- ✅ Failed payments show error
- ✅ Mobile responsive
- ✅ No console errors
- ✅ Fast load time

## 🐛 If Something Goes Wrong

### Widget Not Showing?
- [ ] User has pending payments? Check `tenant_payments` table
- [ ] User logged in? Check session
- [ ] Component imported? Check `app/tenant/dashboard/page.tsx`
- [ ] No TypeScript errors? Run `npm run build`

### Payment Won't Initiate?
- [ ] Phone number entered? Try valid format
- [ ] MTN credentials valid? Check `.env.local`
- [ ] Internet connection? Check DevTools network tab
- [ ] API reachable? Try API endpoint directly

### Status Not Updating?
- [ ] Transaction ID returned? Check `transactionId` state
- [ ] MTN API working? Check MTN developer portal
- [ ] Browser developer tools → Application → Storage
- [ ] Wait 2 minutes max for timeout

## 📚 Documentation

For more details, see:
- `TENANT_PAYMENT_FEATURE.md` - Complete feature guide
- `TENANT_PAYMENT_IMPLEMENTATION.md` - Implementation details
- `components/TenantPaymentWidget.tsx` - Component code comments
- `app/tenant/dashboard/page.tsx` - Integration comments

## ✅ Ready to Deploy?

Checklist before production:

- [ ] Environment variables set correctly
- [ ] MTN credentials verified
- [ ] Database migrations run
- [ ] Build succeeds: `npm run build`
- [ ] No console errors or warnings
- [ ] Tested end-to-end payment flow
- [ ] Mobile tested on real device
- [ ] Error scenarios tested
- [ ] Performance acceptable
- [ ] Ready to go! 🚀
