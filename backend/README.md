# Python Backend for IntouchPay + IntouchSMS

Complete Python FastAPI backend for IntouchPay payment processing and IntouchSMS notifications.

## Features

- **IntouchPay Integration**
  - Request payments from customers
  - Check transaction status
  - Get account balance
  - Deposit/withdrawal requests

- **IntouchSMS Integration**
  - Send individual SMS messages
  - Send payment confirmations
  - Send payment reminders
  - Send bulk SMS to multiple recipients

- **API Endpoints**
  - RESTful API for all payment and SMS operations
  - Webhook support for payment callbacks
  - CORS enabled for frontend integration

## Setup

### 1. Install Python Dependencies

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (optional but recommended)
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment Variables

```bash
# Copy example to .env
cp .env.example .env

# Edit .env with your credentials
# Set your IntouchPay credentials:
INTOUCH_USERNAME=your_username
INTOUCH_ACCOUNT_NO=your_account_number
INTOUCH_PARTNER_PASSWORD=your_partner_password

# Set your IntouchSMS credentials:
INTOUCH_SMS_API_KEY=your_sms_api_key

# Set callback URL (used in payment requests)
CALLBACK_URL=https://yourdomain.com/api/intouch/callback
```

### 3. Run the Backend

```bash
# From backend directory with venv activated
python main.py

# Or using uvicorn directly:
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`
API docs available at `http://localhost:8000/docs`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `INTOUCH_USERNAME` | IntouchPay username | Yes |
| `INTOUCH_ACCOUNT_NO` | IntouchPay account number | Yes |
| `INTOUCH_PARTNER_PASSWORD` | IntouchPay partner password | Yes |
| `INTOUCH_SMS_API_KEY` | IntouchSMS API key | Yes |
| `INTOUCH_ENVIRONMENT` | sandbox or production | No (default: sandbox) |
| `CALLBACK_URL` | Callback URL for payment status | No |
| `FRONTEND_URL` | Frontend application URL | No |
| `BACKEND_URL` | Backend application URL | No |

## API Endpoints

### Health Check
- `GET /health` - Health check endpoint

### Payments
- `POST /api/payments/request` - Request payment from customer
- `GET /api/payments/status` - Check transaction status
- `GET /api/payments/balance` - Get account balance

### SMS
- `POST /api/sms/send` - Send SMS message
- `POST /api/sms/payment-confirmation` - Send payment confirmation
- `POST /api/sms/payment-reminder` - Send payment reminder

### Webhooks
- `POST /api/webhooks/payment` - Payment status webhook

## Integration with Next.js Frontend

### 1. Set Backend URL

Add to `.env.local`:
```env
PYTHON_BACKEND_URL=http://localhost:8000
```

### 2. Use the Service

```typescript
import { intouchPayService } from '@/lib/intouch-pay';

// Request payment
const result = await intouchPayService.requestPayment({
  amount: 50000,
  phone_number: "+250798123456",
  tenant_id: "T001",
  apartment_id: "APT-101",
  month: "June 2024",
  send_sms: true
});

// Send SMS
await intouchPayService.sendSMS({
  phone_number: "+250798123456",
  message: "Your payment has been received"
});

// Send confirmation
await intouchPayService.sendPaymentConfirmationSMS({
  phone_number: "+250798123456",
  tenant_name: "John Doe",
  amount: 50000,
  apartment: "APT-101",
  month: "June 2024",
  reference_id: "TXN-001"
});
```

## Project Structure

```
backend/
├── main.py                 # FastAPI application entry point
├── requirements.txt        # Python dependencies
├── .env.example           # Environment variables template
└── app/
    ├── __init__.py
    ├── config.py          # Configuration settings
    └── services/
        ├── __init__.py
        ├── intouch_pay.py  # IntouchPay service
        └── sms.py         # IntouchSMS service
```

## Examples

### Request Payment

```bash
curl -X POST http://localhost:8000/api/payments/request \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50000,
    "phone_number": "+250798123456",
    "tenant_id": "T001",
    "apartment_id": "APT-101",
    "month": "June 2024",
    "send_sms": true
  }'
```

### Send SMS

```bash
curl -X POST http://localhost:8000/api/sms/send \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+250798123456",
    "message": "Your payment has been received. Thank you!"
  }'
```

### Check Payment Status

```bash
curl http://localhost:8000/api/payments/status \
  -H "Content-Type: application/json" \
  -d '{
    "request_transaction_id": "TXN-001",
    "transaction_id": "6004994884"
  }'
```

## Deployment

### Deploy to Production

1. **Set environment variables** on your hosting platform
2. **Update CALLBACK_URL** to your production domain
3. **Update FRONTEND_URL** to your production domain
4. **Use HTTPS** for all API calls

### Supported Hosting Platforms
- Heroku
- PythonAnywhere
- AWS EC2
- Google Cloud Run
- Azure App Service
- DigitalOcean

## Troubleshooting

### Payment Request Fails
1. Verify IntouchPay credentials are correct
2. Check that callback URL is accessible
3. Ensure account has sufficient balance
4. Check phone number format (include country code)

### SMS Not Sending
1. Verify IntouchSMS API key is correct
2. Check phone number format (+250...)
3. Ensure SMS account has credits
4. Check message length (splits on >160 chars)

### CORS Errors
1. Ensure `FRONTEND_URL` is set correctly
2. Backend CORS is configured for frontend origin
3. Check browser console for exact CORS error

## Security Considerations

- **Never commit** `.env` file with real credentials
- **Use HTTPS** in production
- **Validate** all input from frontend
- **Store** transaction IDs securely
- **Log** all payment activities
- **Implement** rate limiting for API endpoints
- **Verify** webhook signatures (when available)

## Support

For issues:
1. Check the logs: `python main.py` shows all requests/errors
2. Visit IntouchPay API docs: https://www.intouchpay.co.rw/
3. Visit IntouchSMS docs: https://www.intouchsms.co.rw/
4. Check FastAPI docs: http://localhost:8000/docs

## License

[Your License Here]
