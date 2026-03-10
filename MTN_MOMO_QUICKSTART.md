# MTN MoMo Integration - Quick Start Guide

Get your payment system running in 10 minutes! 🚀

## 5-Minute Quick Setup

### 1. Get Your Keys (2 min)
```
✓ Visit: https://momodeveloper.mtn.com
✓ Create account
✓ Subscribe to Collections API
✓ Copy Primary Key & Secondary Key
```

### 2. Update .env.local (1 min)
```bash
# Add to your .env.local file:

MTN_MOMO_PRIMARY_KEY=<your-primary-key>
MTN_MOMO_SECONDARY_KEY=<your-secondary-key>
MTN_MOMO_SUBSCRIPTION_KEY=<your-primary-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Create API User (1 min)
```bash
# In Node.js shell or script:
import { mtnMomoService } from './lib/mtn-momo-service';

const result = await mtnMomoService.createApiUser();
console.log('API User:', result.api_user);
console.log('API Key:', result.api_key);
```

### 4. Add to .env.local (1 min)
```bash
MTN_MOMO_API_USER_ID=<from-above>
MTN_MOMO_API_KEY=<from-above>
```

### 5. Start Server (1 min)
```bash
pnpm dev
# Visit: http://localhost:3000/tenant/payments
```

That's it! You're ready to test! ✅

---

## What Gets Created

| File | Purpose |
|------|---------|
| `scripts/016-add-mtn-momo-payments.sql` | Database schema for MTN MoMo |
| `lib/mtn-momo-service.ts` | Core API service |
| `app/api/payments/mtn-momo/route.ts` | Backend endpoints |
| `components/MTNMoMoPaymentWidget.tsx` | Payment UI component |
| `app/tenant/payments/page.tsx` | Tenant payment dashboard |

---

## How It Works

```
User enters phone number
    ↓
Clicks "Pay with MTN MoMo"
    ↓
API sends request to MTN
    ↓
User gets prompt on phone
    ↓
User enters PIN
    ↓
Payment confirmed
    ↓
Dashboard updates automatically
```

---

## Testing

1. **Open payment page:**
   ```
   http://localhost:3000/tenant/payments
   ```

2. **Create test payment** (via admin if needed)

3. **Click "Pay Now with MTN MoMo"**

4. **Enter test phone number:**
   - Format: `+256789123456` or `0789123456`
   - Ask MTN for test numbers for your region

5. **Check logs:**
   ```sql
   SELECT * FROM mtn_momo_logs ORDER BY created_at DESC;
   ```

---

## Production Checklist

- [ ] Get production keys from MTN
- [ ] Update .env.local with production keys
- [ ] Change endpoint from `sandbox` → `production`
- [ ] Update NEXT_PUBLIC_APP_URL to your domain
- [ ] Deploy to Vercel
- [ ] Add env vars to Vercel dashboard
- [ ] Test with real data
- [ ] Monitor logs

---

## Troubleshooting

**"Invalid subscription key"**
→ Check PRIMARY_KEY in .env.local

**"API User creation failed"**
→ Ensure PRIMARY_KEY is correct and subscription is active

**"Phone number rejected"**
→ Use format: +256... or 0...

**Payment stuck on pending**
→ Check logs: `SELECT * FROM mtn_momo_logs WHERE created_at > NOW() - INTERVAL 1 HOUR;`

---

## Architecture

```
Frontend:
  MTNMoMoPaymentWidget (React component)
    ↑ ↓
Backend:
  /api/payments/mtn-momo (Next.js route handler)
    ↑ ↓
Service:
  mtnMomoService (TypeScript service)
    ↑ ↓
External:
  MTN MoMo API

Database:
  tenant_payments (payment records)
  mtn_momo_logs (API logs)
```

---

## Key Features

✅ **Already Built In:**
- Phone number input validation
- Auto-check payment status (every 3 seconds)
- Shows payment history
- Displays pending & completed payments
- Summary statistics (total due, paid, pending)
- Error handling & user-friendly messages
- Secure credential storage
- Transaction logging
- Database integration

---

## API Examples

### Frontend Component
```tsx
<MTNMoMoPaymentWidget
  paymentId={123}
  amount={50000}
  tenantId={userID}
  onSuccess={(txnId) => alert('Paid!')}
/>
```

### Backend Service
```tsx
// Get token
const token = await mtnMomoService.getAccessToken();

// Request payment
const txnId = await mtnMomoService.requestToPay(
  '+256789123456',
  50000,
  'PAYMENT-123'
);

// Check status
const status = await mtnMomoService.getTransactionStatus(txnId);
```

---

## Next Steps

1. Follow 5-minute setup above
2. Test with sandbox credentials
3. Create admin interface for payment creation
4. Add email notifications
5. Set up webhook for real-time updates
6. Deploy to production

---

## Support Resources

- **Full Guide:** See `MTN_MOMO_SETUP.md`
- **Checklist:** See `MTN_MOMO_CHECKLIST.md`  
- **MTN Docs:** https://momodeveloper.mtn.com/docs
- **Database:** Check `scripts/016-add-mtn-momo-payments.sql`

---

## Environment Variables Reference

```env
# Required for MTN MoMo
MTN_MOMO_PRIMARY_KEY=<subscription-key>
MTN_MOMO_SECONDARY_KEY=<backup-key>
MTN_MOMO_SUBSCRIPTION_KEY=<same-as-primary>
MTN_MOMO_API_USER_ID=<api-user-id>
MTN_MOMO_API_KEY=<api-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

**Ready to integrate?** Start with the 5-minute setup above! 🎉

Questions? Check `MTN_MOMO_SETUP.md` for detailed instructions.
