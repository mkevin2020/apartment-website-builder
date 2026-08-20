import requests
from typing import Dict, Any, List
from ..config import get_settings


class IntouchSMSService:
    def __init__(self):
        self.settings = get_settings()

    def send_sms(
        self,
        phone_number: str,
        message: str,
    ) -> Dict[str, Any]:
        """
        Send SMS via IntouchSMS
        
        Args:
            phone_number: Recipient phone number (with country code, e.g., +250...)
            message: SMS message content
            
        Returns:
            API response from IntouchSMS
        """
        try:
            # Ensure phone number is properly formatted
            if not phone_number.startswith("+"):
                phone_number = f"+{phone_number}"

            payload = {
                "username": self.settings.intouch_username,
                "api_key": self.settings.intouch_sms_api_key,
                "message": message,
                "phone_number": phone_number,
            }

            response = requests.post(
                self.settings.intouch_sms_api_url,
                json=payload,
                timeout=10
            )
            response.raise_for_status()
            
            return {
                "success": True,
                "data": response.json(),
                "phone_number": phone_number,
            }
        except requests.exceptions.RequestException as e:
            return {
                "success": False,
                "error": str(e),
                "phone_number": phone_number,
            }

    def send_payment_confirmation(
        self,
        phone_number: str,
        tenant_name: str,
        amount: float,
        apartment: str,
        month: str,
        reference_id: str,
    ) -> Dict[str, Any]:
        """
        Send payment confirmation SMS
        """
        message = (
            f"Hi {tenant_name}, your payment of RWF {amount:,.0f} for "
            f"{apartment} ({month}) has been received. "
            f"Reference: {reference_id}. Thank you!"
        )
        return self.send_sms(phone_number, message)

    def send_payment_failure(
        self,
        phone_number: str,
        tenant_name: str,
        amount: float,
        reason: str,
    ) -> Dict[str, Any]:
        """
        Send payment failure notification
        """
        message = (
            f"Hi {tenant_name}, your payment of RWF {amount:,.0f} failed. "
            f"Reason: {reason}. Please try again or contact support."
        )
        return self.send_sms(phone_number, message)

    def send_payment_reminder(
        self,
        phone_number: str,
        tenant_name: str,
        amount: float,
        apartment: str,
        due_date: str,
    ) -> Dict[str, Any]:
        """
        Send payment reminder SMS
        """
        message = (
            f"Hi {tenant_name}, reminder: RWF {amount:,.0f} is due for "
            f"{apartment} by {due_date}. Please pay now to avoid penalties."
        )
        return self.send_sms(phone_number, message)

    def send_bulk_sms(
        self,
        recipients: List[Dict[str, str]],
        message: str,
    ) -> Dict[str, Any]:
        """
        Send bulk SMS to multiple recipients
        
        Args:
            recipients: List of dicts with 'phone_number' and optional 'name'
            message: SMS message (can include {name} placeholder)
            
        Returns:
            Summary of bulk send results
        """
        results = {
            "success": [],
            "failed": [],
            "total_sent": 0,
        }

        for recipient in recipients:
            phone = recipient.get("phone_number")
            name = recipient.get("name", "Tenant")
            
            # Replace placeholder if message contains {name}
            personalized_message = message.replace("{name}", name)
            
            result = self.send_sms(phone, personalized_message)
            
            if result["success"]:
                results["success"].append(phone)
                results["total_sent"] += 1
            else:
                results["failed"].append({
                    "phone_number": phone,
                    "error": result.get("error")
                })

        return results
