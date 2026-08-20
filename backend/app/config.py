from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # IntouchPay Configuration
    intouch_username: str
    intouch_account_no: str
    intouch_partner_password: str
    intouch_environment: str = "sandbox"
    intouch_payment_api_url: str = "https://www.intouchpay.co.rw/api/requestpayment/"
    intouch_deposit_api_url: str = "https://www.intouchpay.co.rw/api/requestdeposit/"
    intouch_status_api_url: str = "https://www.intouchpay.co.rw/api/gettransactionstatus/"
    intouch_balance_api_url: str = "https://www.intouchpay.co.rw/api/getbalance/"
    
    # IntouchSMS Configuration
    intouch_sms_api_key: str
    intouch_sms_api_url: str = "https://api.intouchsms.co.rw/api/send"
    
    # Application Configuration
    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"
    callback_url: str = "http://localhost:3000/api/intouch/callback"
    database_url: str = "sqlite:///./app.db"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings():
    return Settings()
