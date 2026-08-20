import hashlib
import requests
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel
from ..config import get_settings


class PaymentRequest(BaseModel):
    amount: float
    phone_number: str
    tenant_id: str
    apartment_id: str
    month: str
    description: str = "Apartment Rent Payment"


class DepositRequest(BaseModel):
    amount: float
    phone_number: str
    reason: str
    sid: int = 1


class TransactionStatusRequest(BaseModel):
    request_transaction_id: str
    transaction_id: str


class IntouchPayService:
    def __init__(self):
        self.settings = get_settings()

    def _generate_password(self, timestamp: str) -> str:
        """
        Generate SHA256 password hash for IntouchPay authentication
        password = SHA256(username + accountno + partnerpassword + timestamp)
        """
        raw = (
            self.settings.intouch_username 
            + self.settings.intouch_account_no 
            + self.settings.intouch_partner_password 
            + timestamp
        )
        return hashlib.sha256(raw.encode()).hexdigest()

    def _get_timestamp(self) -> str:
        """Get current UTC timestamp in YYYYMMDDHHmmss format"""
        return datetime.utcnow().strftime("%Y%m%d%H%M%S")

    def request_payment(
        self,
        payment_request: PaymentRequest,
        request_transaction_id: str,
    ) -> Dict[str, Any]:
        """
        Request payment from customer via IntouchPay
        
        Args:
            payment_request: Payment details
            request_transaction_id: Unique transaction ID from your system
            
        Returns:
            API response from IntouchPay
        """
        try:
            timestamp = self._get_timestamp()
            password = self._generate_password(timestamp)

            payload = {
                "username": self.settings.intouch_username,
                "timestamp": timestamp,
                "amount": int(payment_request.amount * 100),  # Convert to cents
                "mobilephone": payment_request.phone_number,
                "requesttransactionid": request_transaction_id,
                "accountno": self.settings.intouch_account_no,
                "password": password,
                "callbackurl": self.settings.callback_url,
            }

            response = requests.post(
                self.settings.intouch_payment_api_url,
                data=payload,
                timeout=30
            )
            response.raise_for_status()
            
            return {
                "success": True,
                "data": response.json(),
                "request_id": request_transaction_id,
            }
        except requests.exceptions.RequestException as e:
            return {
                "success": False,
                "error": str(e),
                "request_id": request_transaction_id,
            }

    def request_deposit(
        self,
        deposit_request: DepositRequest,
        request_transaction_id: str,
    ) -> Dict[str, Any]:
        """
        Request deposit (withdrawal) from IntouchPay account
        
        Args:
            deposit_request: Deposit details
            request_transaction_id: Unique transaction ID
            
        Returns:
            API response from IntouchPay
        """
        try:
            timestamp = self._get_timestamp()
            password = self._generate_password(timestamp)

            payload = {
                "username": self.settings.intouch_username,
                "timestamp": timestamp,
                "amount": int(deposit_request.amount * 100),
                "withdrawcharge": 1,
                "reason": deposit_request.reason,
                "sid": deposit_request.sid,
                "mobilephone": deposit_request.phone_number,
                "requesttransactionid": request_transaction_id,
                "accountno": self.settings.intouch_account_no,
                "password": password,
            }

            response = requests.post(
                self.settings.intouch_deposit_api_url,
                data=payload,
                timeout=30
            )
            response.raise_for_status()
            
            return {
                "success": True,
                "data": response.json(),
                "request_id": request_transaction_id,
            }
        except requests.exceptions.RequestException as e:
            return {
                "success": False,
                "error": str(e),
                "request_id": request_transaction_id,
            }

    def get_transaction_status(
        self,
        request_transaction_id: str,
        transaction_id: str,
    ) -> Dict[str, Any]:
        """
        Check transaction status
        
        Args:
            request_transaction_id: Your transaction ID
            transaction_id: IntouchPay transaction ID
            
        Returns:
            Transaction status details
        """
        try:
            timestamp = self._get_timestamp()
            password = self._generate_password(timestamp)

            payload = {
                "username": self.settings.intouch_username,
                "timestamp": timestamp,
                "password": password,
                "requesttransactionid": request_transaction_id,
                "transactionid": transaction_id,
            }

            response = requests.post(
                self.settings.intouch_status_api_url,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            
            return {
                "success": True,
                "data": response.json(),
                "request_id": request_transaction_id,
            }
        except requests.exceptions.RequestException as e:
            return {
                "success": False,
                "error": str(e),
                "request_id": request_transaction_id,
            }

    def get_balance(self) -> Dict[str, Any]:
        """
        Get IntouchPay account balance
        
        Returns:
            Account balance details
        """
        try:
            timestamp = self._get_timestamp()
            password = self._generate_password(timestamp)

            payload = {
                "username": self.settings.intouch_username,
                "timestamp": timestamp,
                "accountno": self.settings.intouch_account_no,
                "password": password,
            }

            response = requests.post(
                self.settings.intouch_balance_api_url,
                data=payload,
                timeout=30
            )
            response.raise_for_status()
            
            return {
                "success": True,
                "data": response.json(),
            }
        except requests.exceptions.RequestException as e:
            return {
                "success": False,
                "error": str(e),
            }
