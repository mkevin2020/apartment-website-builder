# MTN MoMo Integration - Testing & Validation Guide

## Quick Validation Without Full MTN Setup

Want to test the UI/UX before getting MTN credentials? Here's how!

## Option 1: Mock Testing (No MTN Account Needed)

### Step 1: Create Mock Service

Create `lib/mtn-momo-service.mock.ts`:

```typescript
/**
 * Mock MTN MoMo Service for Testing
 * Replace real service with this for UI testing
 */

export class MTNMoMoServiceMock {
  async getAccessToken(): Promise<string> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return 'mock-token-' + Date.now();
  }

  async requestToPay(
    phoneNumber: string,
    amount: number,
    externalId: string,
    payerMessage: string = 'Test payment',
    payeeNote: string = 'Test received'
  ): Promise<string> {
    // Validate phone number format
    if (!phoneNumber.includes('256') && !phoneNumber.includes('789')) {
      throw new Error('Invalid phone number format');
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Return mock transaction ID
    const transactionId = 'MOCK-' + Date.now() + '-' + Math.random().toString(36).substring(7);
    
    console.log(`[MOCK] Payment Request:`, {
      phoneNumber,
      amount,
      externalId,
      transactionId
    });

    return transactionId;
  }

  async getTransactionStatus(transactionId: string): Promise<any> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // For testing, if transaction started less than 30 seconds ago, return PENDING
    // Otherwise return SUCCESSFUL
    const createdTime = parseInt(transactionId.split('-')[1]) || 0;
    const now = Date.now();
    const elapsedSeconds = (now - createdTime) / 1000;

    const status = elapsedSeconds > 5 ? 'SUCCESSFUL' : 'PENDING';

    console.log(`[MOCK] Status Check:`, {
      transactionId,
      status,
      elapsedSeconds
    });

    return {
      financial_transaction_id: 'MOCK-TXN-' + Date.now(),
      status: status,
    };
  }
}

export const mtnMomoService = new MTNMoMoServiceMock();
```

### Step 2: Use Mock Service

Replace in `lib/mtn-momo-service.ts` or route:

```typescript
// Use this during development/testing:
import { mtnMomoService } from '@/lib/mtn-momo-service.mock';

// Switch to real service for production:
import { mtnMomoService } from '@/lib/mtn-momo-service';
```

### Step 3: Test the UI

```bash
pnpm dev
# Visit: http://localhost:3000/tenant/payments
# Try entering: +256789123456
# Watch the mock service in console logs
```

---

## Option 2: Sandbox Testing (With MTN Account)

### Prerequisites

- [ ] MTN MoMo developer account created
- [ ] Primary & Secondary Keys obtained
- [ ] API User created
- [ ] API Key generated
- [ ] All .env.local variables set

### Test Scenarios

#### Test 1: Successful Payment Request

```bash
# Steps:
1. Go to http://localhost:3000/tenant/payments
2. Click "Pay Now with MTN MoMo"
3. Enter valid test phone: +256789123456
4. Click "Request Payment"
5. Should see: "Payment request sent to phone"
6. Transaction ID should appear

# Check:
SELECT * FROM mtn_momo_logs 
WHERE request_type = 'request_to_pay'
ORDER BY created_at DESC LIMIT 1;
```

#### Test 2: Status Checking

```bash
# The widget auto-checks status every 3 seconds
# Or click "Check Status Now" button manually

# In real scenario, user would confirm on their phone
# In sandbox, status will eventually become SUCCESSFUL

# Verify:
SELECT * FROM tenant_payments 
WHERE transaction_id IS NOT NULL
ORDER BY created_at DESC LIMIT 1;
```

#### Test 3: Error Handling

```bash
# Try invalid phone number:
- abc123 (wrong format) → Should show error
- (empty) → Should disable button
- 256789123456 (too many digits) → Should show error

# Try network error:
1. Disconnect internet
2. Click "Request Payment"
3. Should show: "Failed to initiate payment"
4. Reconnect and retry
```

#### Test 4: Long Payment Processing

```bash
# For testing timeout scenarios:

# Modify mtn-momo-service.ts temporarily:
async requestToPay(...) {
  // Add delay to simulate slow network
  await new Promise(r => setTimeout(r, 5000));
  // ...
}

# Now watch UI while waiting:
- Should show loading state
- "Check Status Now" button should be clickable
- Widget should auto-check status
```

---

## Real Scenario Testing

Once you have MTN credentials and want to test with real API:

### Prerequisites

- [ ] MTN account activated (not sandbox)
- [ ] Production keys obtained
- [ ] Real test phone numbers from MTN
- [ ] Sufficient test funds

### Test Flow

```bash
# 1. Update .env.local with production keys
GTN_MOMO_PRIMARY_KEY=<production-key>
MTN_MOMO_SUBSCRIPTION_KEY=<production-key>

# 2. Restart server
pnpm dev

# 3. Test with real phone number (provided by MTN)
# Navigate to payments page
# Enter real test phone number
# Request payment
# User receives actual MTN prompt
# User enters PIN
# Transaction processes

# 4. Verify in database
SELECT * FROM tenant_payments WHERE transaction_id IS NOT NULL;

# 5. Check logs
SELECT * FROM mtn_momo_logs 
WHERE created_at > NOW() - INTERVAL 1 HOUR
ORDER BY created_at DESC;
```

---

## Comprehensive Test Checklist

### 1. Frontend UI Tests

- [ ] **Payment Widget Renders**
  ```
  - Phone input visible
  - Button visible
  - No console errors
  ```

- [ ] **Phone Number Validation**
  ```
  - No input, button disabled ✓
  - Invalid format, shows error ✓
  - Valid format, button enabled ✓
  ```

- [ ] **Loading States**
  ```
  - Button shows loading spinner ✓
  - Input disabled while processing ✓
  - "Processing..." text shows ✓
  ```

- [ ] **Status Updates**
  ```
  - Shows "pending" status ✓
  - Auto-checks every 3 seconds ✓
  - Manual check button works ✓
  - Shows success when complete ✓
  ```

- [ ] **Error Messages**
  ```
  - Shows meaningful error messages ✓
  - Error message disappears on retry ✓
  - Network errors handled ✓
  ```

### 2. Backend Tests

- [ ] **API Endpoint Tests**
  ```bash
  # Test payment initiation
  curl -X POST http://localhost:3000/api/payments/mtn-momo \
    -H "Content-Type: application/json" \
    -d '{
      "paymentId": 1,
      "phoneNumber": "+256789123456",
      "amount": 50000,
      "tenantId": "123"
    }'
  
  # Response should include transactionId
  ```

- [ ] **Status Check API**
  ```bash
  curl http://localhost:3000/api/payments/mtn-momo?transactionId=MOCK-xxx&paymentId=1
  
  # Response should include status
  ```

### 3. Database Tests

- [ ] **Payment Record Created**
  ```sql
  SELECT * FROM tenant_payments 
  WHERE phone_number = '+256789123456';
  -- Should have: transaction_id, phone_number, payment_gateway
  ```

- [ ] **Logs Recorded**
  ```sql
  SELECT * FROM mtn_momo_logs
  WHERE request_type = 'request_to_pay';
  -- Should have: request_body, response_body
  ```

- [ ] **Status Updates**
  ```sql
  SELECT status, mtn_reference_code FROM tenant_payments
  WHERE id = 1;
  -- Status should change from pending to completed
  ```

### 4. Integration Tests

- [ ] **End-to-End Flow**
  ```
  1. User enters payment page
  2. User clicks "Pay with MTN MoMo"
  3. User enters phone number
  4. Payment initiated
  5. Status checked
  6. Payment marked complete
  7. Database updated
  ```

- [ ] **Error Recovery**
  ```
  1. Payment initiation fails
  2. Error message shown
  3. User can retry
  4. Retry succeeds
  ```

- [ ] **Multiple Payments**
  ```
  1. Create 3 payments
  2. Pay for each one
  3. Dashboard shows correct status for each
  4. History shows all payments
  ```

### 5. Performance Tests

- [ ] **Page Load Time**
  ```
  - Initial load < 2 seconds
  - Widget renders in < 500ms
  ```

- [ ] **Status Check Latency**
  ```
  - Status API responds in < 1 second
  - Auto-check doesn't block UI
  ```

- [ ] **Database Queries**
  ```
  - Payment fetch < 500ms for 100 records
  - Log queries indexed properly
  ```

---

## Debugging Tips

### Enable Verbose Logging

Add to your API route:

```typescript
// In app/api/payments/mtn-momo/route.ts
const DEBUG = true;

if (DEBUG) {
  console.log('Request:', { paymentId, phoneNumber, amount });
  console.log('Response:', data);
  console.log('Database update:', { updateError });
}
```

### Monitor Network Requests

```bash
# In browser dev tools:
1. Open Network tab
2. Clear network log
3. Click "Request Payment"
4. Watch requests to /api/payments/mtn-momo
5. Click responses to see JSON
```

### Check Database Directly

```sql
-- Connect to Supabase
-- Run these queries:

-- See all MTN MoMo payments
SELECT * FROM tenant_payments WHERE payment_gateway = 'mtn_momo';

-- See all logs
SELECT * FROM mtn_momo_logs ORDER BY created_at DESC;

-- See specific payment
SELECT tp.*, ml.* FROM tenant_payments tp
LEFT JOIN mtn_momo_logs ml ON tp.id = ml.payment_id
WHERE tp.id = 1;
```

### View Service Logs

```typescript
// In lib/mtn-momo-service.ts, add:
console.log('[MTN MoMo]', 'getAccessToken', { success: true });
console.log('[MTN MoMo]', 'requestToPay', { transactionId, phoneNumber });
console.log('[MTN MoMo]', 'getTransactionStatus', { status });
```

---

## Common Test Scenarios

### Scenario 1: Happy Path

```
1. User goes to /tenant/payments
2. Sees payment due: 50,000 XOF
3. Clicks "Pay Now"
4. Enters: +256789123456
5. Clicks "Request Payment"
6. System shows: "Check your phone"
7. User confirms on phone
8. Dashboard updates to "Completed"
9. Success message appears
```

### Scenario 2: Forgot Phone Format

```
1. User enters: 0789123456 (local format)
2. System auto-formats to: +256789123456
3. Payment works normally
```

### Scenario 3: User Cancels

```
1. User gets prompt on phone
2. User presses cancel
3. Dashboard stays on "pending"
4. User can retry
```

### Scenario 4: Network Timeout

```
1. User calls API but network fails
2. User sees: "Failed to initiate payment"
3. User clicks retry
4. Works second time
```

---

## Production Testing Checklist

Before deploying to production:

- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] API endpoints tested
- [ ] Widget UI tested on mobile
- [ ] Error scenarios tested
- [ ] Payment history displays correctly
- [ ] Status updates work reliably
- [ ] Logs show correct information
- [ ] Security headers present
- [ ] Rate limiting working (if added)
- [ ] HTTPS enforced
- [ ] No test data in production
- [ ] Backup/recovery plan ready

---

## Performance & Load Testing

### Simulate High Load

```typescript
// Create test script:
const paymentIds = [1, 2, 3, 4, 5];

for (const id of paymentIds) {
  await fetch('/api/payments/mtn-momo', {
    method: 'POST',
    body: JSON.stringify({
      paymentId: id,
      phoneNumber: '+256789123456',
      amount: 50000,
      tenantId: 'test',
    }),
  });
}

// Monitor:
- API response time
- Database load
- Error rates
- Memory usage
```

---

## Test Data Setup

### Create Test Payments

```sql
-- Create a test apartment
INSERT INTO apartments (building_number, floor_number, apartment_number, status)
VALUES ('Building A', 1, '101', 'available');

-- Create test payments  
INSERT INTO tenant_payments (tenant_id, apartment_id, amount, due_date, status, payment_method)
VALUES 
  (1, 1, 50000, '2024-03-31', 'pending', NULL),
  (1, 1, 50000, '2024-04-30', 'pending', NULL),
  (1, 1, 50000, '2024-05-31', 'completed', 'mtn_momo');
```

---

## Validation Queries

```sql
-- Count pending payments
SELECT COUNT(*) FROM tenant_payments WHERE status = 'pending';

-- Sum amount due
SELECT SUM(amount) FROM tenant_payments WHERE status = 'pending';

-- Check MTN MoMo specific
SELECT COUNT(*) FROM tenant_payments WHERE payment_gateway = 'mtn_momo';

-- View transaction success rate
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
  ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM tenant_payments
WHERE payment_gateway = 'mtn_momo';
```

---

## Next Steps

1. ✅ Test with mock service first
2. ✅ Set up sandbox testing
3. ✅ Run through all test scenarios
4. ✅ Verify database operations
5. ✅ Check error handling
6. ✅ Monitor logs for issues
7. ⏭️ Deploy to staging
8. ⏭️ Get production credentials
9. ⏭️ Deploy to production
10. ⏭️ Monitor production payments

---

## Support

**Issue:** Tests pass but payment not working
→ Check env vars, restart server

**Issue:** Widget not updating status
→ Check browser console, check API response

**Issue:** Database not updating
→ Check logs table, verify RLS policies

**Issue:** Phone number rejected
→ Check format, verify country code

---

**Happy testing!** 🎉
