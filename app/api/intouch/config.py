import os
from dotenv import load_dotenv

load_dotenv()

# Python Backend URL
PYTHON_BACKEND_URL = os.getenv("PYTHON_BACKEND_URL", "http://localhost:8000")

class PaymentConfig:
    """Payment configuration for both Stripe and IntouchPay"""
    
    # Stripe
    STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
    STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
    
    # IntouchPay
    INTOUCH_USERNAME = os.getenv("INTOUCH_USERNAME")
    INTOUCH_ACCOUNT_NO = os.getenv("INTOUCH_ACCOUNT_NO")
    INTOUCH_PARTNER_PASSWORD = os.getenv("INTOUCH_PARTNER_PASSWORD")
    
    # Python Backend
    PYTHON_BACKEND_URL = PYTHON_BACKEND_URL

payment_config = PaymentConfig()
