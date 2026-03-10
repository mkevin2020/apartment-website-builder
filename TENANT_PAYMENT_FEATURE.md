# Tenant Dashboard Payment Feature

## Overview

The tenant dashboard now includes an integrated payment widget that allows tenants to make payments directly from their dashboard using MTN MoMo payment system.

## Features

### 1. **Pending Payments Display**
- Shows all pending payments at the top of the dashboard
- Displays total amount due across all pending payments
- Shows due date for each payment
- Color-coded payment status (pending, overdue, etc.)

### 2. **Direct Payment Processing**
- Select a payment to pay directly from the dashboard
- Enter MTN phone number to initiate payment
- Real-time payment status checking
- Auto-refreshes when payment is confirmed

### 3. **Payment Widget Features**
- **Responsive Design**: Works on all screen sizes
- **Phone Number Input**: Accepts various formats (250XXXXXXXXX, +250XXXXXXXXX)
- **Payment Status Tracking**: Auto-checks payment status every 3 seconds
- **Transaction ID**: Shows transaction ID for reference
- **Error Handling**: Clear error messages if payment fails
- **Success Feedback**: Displays confirmation message when payment succeeds

## How to Use

### Making a Payment

1. **View Dashboard**: Tenant logs into their dashboard
2. **See Pending Payments**: If there are pending payments, the alert will be shown at the top and the payment widget in the right column
3. **Select Payment**: Click on the payment you want to pay in the widget
4. **Enter Phone Number**: Input your MTN phone number
5. **Initiate Payment**: Click "Pay [Amount] XOF" button
6. **Confirm on Phone**: You'll receive a payment prompt on your MTN phone
7. **Automatic Confirmation**: The system auto-checks and updates when payment is confirmed

### Visual Indicators

- **Total Due**: Large, highlighted amount at the top
- **Selected Payment**: Highlighted with blue border
- **Payment Status**: Shows as "in progress", "successful", etc.
- **Auto-refresh**: Reloads page after successful payment

## Technical Implementation

### Components

#### `TenantPaymentWidget`
- **Location**: `components/TenantPaymentWidget.tsx`
- **Props**:
  - `pendingPayments`: Array of Payment objects
  - `tenantId`: Tenant ID string
  - `onPaymentSuccess`: Optional callback function
  
- **States**:
  - `selectedPaymentId`: Currently selected payment
  - `phoneNumber`: Entered phone number
  - `loading`: Loading state during payment initiation
  - `error`: Error messages
  - `success`: Payment success state
  - `transactionId`: MTN MoMo transaction ID
  - `paymentStatus`: Current payment status
  - `checkingStatus`: Status checking state

#### Dashboard Integration
- **File**: `app/tenant/dashboard/page.tsx`
- **Location**: Right column, above Quick Actions
- **Visibility**: Only shows when there are pending payments
- **Import**: `import { TenantPaymentWidget } from "@/components/TenantPaymentWidget";`

### API Integration

The widget uses the existing MTN MoMo API routes:

#### Payment Initiation
```
POST /api/payments/mtn-momo
Body: {
  paymentId: number,
  phoneNumber: string,
  amount: number,
  tenantId: string
}
Response: {
  transactionId: string
}
```

#### Status Checking
```
GET /api/payments/mtn-momo?transactionId={id}&paymentId={id}
Response: {
  status: string,
  ...
}
```

## Payment Flow

```
1. Tenant sees pending payments in dashboard
   ↓
2. Tenant selects a payment from the widget
   ↓
3. Tenant enters MTN phone number
   ↓
4. System initiates payment via MTN MoMo API
   ↓
5. MTN sends payment prompt to tenant's phone
   ↓
6. System auto-checks payment status every 3 seconds
   ↓
7. Once confirmed, page auto-reloads
   ↓
8. Payment marked as paid in the system
```

## Status Checking

The widget auto-checks payment status for up to 2 minutes (40 attempts × 3 seconds):
- If status becomes "SUCCESSFUL" or "paid": Payment confirmed
- If status becomes "FAILED" or "failed": Payment failed, retry needed
- If timeout: User can manually refresh or try again

## Error Handling

The widget handles various error scenarios:

1. **Missing Phone Number**: Shows validation error
2. **No Payment Selected**: Prevents payment without selection
3. **API Errors**: Displays error message from API
4. **Network Errors**: Handles network timeouts gracefully
5. **Payment Failures**: Shows failure message and allows retry

## Currency and Formatting

- **Currency**: XOF (West African CFA franc) - configurable via env vars
- **Amount Format**: Comma-separated numbers (e.g., "1,500 XOF")
- **Date Format**: Localized format (e.g., "March 9, 2026")

## Environment Configuration

The payment system uses MTN MoMo credentials from `.env.local`:

```
MTN_MOMO_PRIMARY_KEY=your-key
MTN_MOMO_API_USER_ID=your-uuid
MTN_MOMO_API_KEY=your-40-char-key
MTN_MOMO_SUBSCRIPTION_KEY=your-subscription-key
MTN_MOMO_ENVIRONMENT=sandbox|production
MTN_MOMO_CURRENCY=XOF
MTN_MOMO_COUNTRY_CODE=250
```

## Testing

### Manual Testing Steps

1. **Login as Tenant**: Navigate to tenant dashboard
2. **Check Pending Payments**: Verify widget shows if there are pending payments
3. **Select Payment**: Click on a payment to select it
4. **Enter Phone**: Input a test phone number
5. **Initiate Payment**: Click pay button
6. **Check Status**: Monitor auto-status checking in widget
7. **Confirm on Phone**: Using test account, confirm payment
8. **Verify Completion**: Wait for auto-refresh and confirm payment is marked as paid

### Test Credentials

Use sandbox environment credentials from MTN MoMo Developer Portal:
- Portal: https://momodeveloper.mtn.com/
- Environment: sandbox
- Test phone numbers: Provided by MTN

## Security Features

1. **Server-side Validation**: All payments validated on backend
2. **Tenant Verification**: Only tenants can see their own payments
3. **Amount Verification**: System verifies correct amount is paid
4. **Transaction Tracking**: All transactions logged in database
5. **Secure API**: Uses secure HTTPS for all API calls

## Future Enhancements

Potential improvements:

1. **Partial Payments**: Allow paying partial amounts
2. **Payment History in Widget**: Show recent payments directly
3. **Automated Reminders**: Send reminders before due dates
4. **Multiple Payment Methods**: Add other payment options
5. **Invoice Generation**: Generate and download invoices
6. **Recurring Payments**: Set up automatic monthly payments
7. **Receipt Email**: Automatically email receipt after payment

## Troubleshooting

### Widget Not Showing
- Check if `pendingPayments.length > 0`
- Verify tenant is logged in properly
- Check browser console for errors

### Payment Not Initiating
- Verify MTN credentials in `.env.local`
- Check phone number format (must match country code)
- Ensure internet connection is stable
- Check MTN MoMo API status

### Status Not Updated
- Check if phone received payment prompt
- Verify transaction ID in the widget
- Wait for status auto-check (up to 2 minutes)
- Manually refresh if timeout occurs

### Payment Marked as Pending Indefinitely
- Check MTN MoMo logs for any errors
- Verify payment actually went through on phone
- Contact support with transaction ID

## Database Integration

The payment widget works with the `tenant_payments` table:

```
tenant_payments {
  id: number (primary key)
  tenant_id: string
  apartment_id: number
  amount: number
  status: string (paid, pending, overdue)
  due_date: date
  reference_number: string
  transaction_id?: string
  payment_date?: date
  payment_method?: string
}
```

## Support

For issues or questions:
1. Check this documentation
2. Review API logs in `/api/payments/mtn-momo`
3. Check MTN MoMo developer portal for API issues
4. Contact system administrator
