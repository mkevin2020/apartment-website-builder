import logging
import os
import uuid
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from app.config import get_settings, Settings
from app.security import enforce_body_limit, require_internal_key
from app.services import IntouchPayService, IntouchSMSService, PaymentRequest

logger = logging.getLogger("payments")
logging.basicConfig(level=logging.INFO)

IS_PRODUCTION = os.getenv("APP_ENV", "development").lower() == "production"

app = FastAPI(
    title="Apartment Payment Backend",
    description="Internal service for IntouchPay and IntouchSMS integration",
    version="1.1.0",
    # The interactive docs enumerate every endpoint and schema. Useful locally,
    # free reconnaissance in production.
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

settings = get_settings()

# ── CORS ────────────────────────────────────────────────────────────────────
# This service is called server-to-server by the Next.js backend, never by a
# browser, so no origin needs credentialed cross-origin access. The previous
# configuration paired allow_credentials=True with allow_methods=["*"] and
# allow_headers=["*"], which is the permissive end of the spectrum for a service
# that spends money. Origins are still listed for local tooling, but credentials
# are off and the method/header lists are explicit.
_allowed_origins = [o for o in {settings.frontend_url, "http://localhost:3000", "http://localhost:3001"} if o]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[] if IS_PRODUCTION else _allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Internal-Key"],
    max_age=600,
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Baseline headers. This service returns JSON only, but a stray HTML error
    page rendered in a browser should still not sniff or frame."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Cache-Control"] = "no-store"
    if IS_PRODUCTION:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Every endpoint previously ended in `except Exception as e: detail=str(e)`,
    which returned driver errors, upstream URLs and occasionally credentials to
    the caller. Log the detail server-side; return an opaque message.
    """
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "error": "Internal server error"},
    )


# ==================== Models ====================
# Field constraints are the input-validation layer: they run before any handler
# body and reject junk (negative amounts, 10 MB description strings) at the edge.


class PaymentRequestBody(BaseModel):
    amount: float = Field(gt=0, le=100_000_000)
    phone_number: str = Field(min_length=9, max_length=20)
    tenant_id: str = Field(min_length=1, max_length=64)
    apartment_id: str = Field(min_length=1, max_length=64)
    month: str = Field(min_length=1, max_length=32)
    description: Optional[str] = Field(default="Apartment Rent Payment", max_length=200)
    send_sms: Optional[bool] = True

    @field_validator("phone_number")
    @classmethod
    def digits_only(cls, v: str) -> str:
        cleaned = v.replace(" ", "").replace("-", "")
        stripped = cleaned[1:] if cleaned.startswith("+") else cleaned
        if not stripped.isdigit():
            raise ValueError("phone_number must contain digits only")
        return cleaned


class SMSRequestBody(BaseModel):
    phone_number: str = Field(min_length=9, max_length=20)
    # Capped so this cannot be used to send (and be billed for) a 400-part SMS.
    message: str = Field(min_length=1, max_length=640)


class PaymentConfirmationSMSBody(BaseModel):
    phone_number: str = Field(min_length=9, max_length=20)
    tenant_name: str = Field(min_length=1, max_length=120)
    amount: float = Field(gt=0, le=100_000_000)
    apartment: str = Field(min_length=1, max_length=120)
    month: str = Field(min_length=1, max_length=32)
    reference_id: str = Field(min_length=1, max_length=64)


class PaymentReminderSMSBody(BaseModel):
    """Previously these arrived as bare query parameters, which put tenant names
    and amounts into access logs. Moved into a POST body."""

    phone_number: str = Field(min_length=9, max_length=20)
    tenant_name: str = Field(min_length=1, max_length=120)
    amount: float = Field(gt=0, le=100_000_000)
    apartment: str = Field(min_length=1, max_length=120)
    due_date: str = Field(min_length=1, max_length=32)


class TransactionStatusBody(BaseModel):
    request_transaction_id: str = Field(min_length=1, max_length=128)
    transaction_id: str = Field(min_length=1, max_length=128)


# Applied to every route that spends money, sends SMS, or reads account state.
INTERNAL = [Depends(require_internal_key), Depends(enforce_body_limit)]


# ==================== Health Check ====================


@app.get("/health")
async def health_check():
    """Unauthenticated on purpose — load balancers need it. Returns no
    configuration, no version of upstream services, no account state."""
    return {"status": "healthy"}


# ==================== Payment Endpoints ====================


@app.post("/api/payments/request", dependencies=INTERNAL)
async def request_payment(
    payment_request: PaymentRequestBody,
    settings: Settings = Depends(get_settings),
):
    """Request payment from a tenant via IntouchPay."""
    pay_service = IntouchPayService()
    sms_service = IntouchSMSService()

    transaction_id = (
        f"TXN-{payment_request.tenant_id}-{payment_request.apartment_id}-"
        f"{uuid.uuid4().hex[:8]}"
    ).upper()

    intouch_request = PaymentRequest(
        amount=payment_request.amount,
        phone_number=payment_request.phone_number,
        tenant_id=payment_request.tenant_id,
        apartment_id=payment_request.apartment_id,
        month=payment_request.month,
        description=payment_request.description,
    )

    result = pay_service.request_payment(intouch_request, transaction_id)

    if not result["success"]:
        # Log the upstream reason; do not hand it to the caller verbatim.
        logger.warning("IntouchPay rejected %s: %s", transaction_id, result.get("error"))
        raise HTTPException(status_code=400, detail="Payment request failed.")

    if payment_request.send_sms:
        sms_message = (
            f"Hi {payment_request.tenant_id}, payment of RWF {payment_request.amount:,.0f} "
            f"for {payment_request.apartment_id} is due. Click link to pay. Thank you!"
        )
        try:
            sms_service.send_sms(payment_request.phone_number, sms_message)
        except Exception:
            # A failed notification must not fail an initiated payment.
            logger.exception("Notification SMS failed for %s", transaction_id)

    logger.info("Payment requested: %s", transaction_id)
    return {"success": True, "transaction_id": transaction_id, "data": result.get("data")}


@app.get("/api/payments/status", dependencies=[Depends(require_internal_key)])
async def check_payment_status(
    request_transaction_id: str,
    transaction_id: str,
    settings: Settings = Depends(get_settings),
):
    """Check payment transaction status."""
    if len(request_transaction_id) > 128 or len(transaction_id) > 128:
        raise HTTPException(status_code=400, detail="Invalid transaction identifier.")

    pay_service = IntouchPayService()
    result = pay_service.get_transaction_status(request_transaction_id, transaction_id)

    if not result["success"]:
        logger.warning("Status lookup failed for %s: %s", transaction_id, result.get("error"))
        raise HTTPException(status_code=400, detail="Could not retrieve transaction status.")

    return result.get("data")


@app.get("/api/payments/balance", dependencies=[Depends(require_internal_key)])
async def get_account_balance(settings: Settings = Depends(get_settings)):
    """Merchant account balance. Internal callers only — this is commercially
    sensitive and was previously world-readable."""
    pay_service = IntouchPayService()
    result = pay_service.get_balance()

    if not result["success"]:
        logger.warning("Balance lookup failed: %s", result.get("error"))
        raise HTTPException(status_code=400, detail="Could not retrieve balance.")

    return result.get("data")


# ==================== SMS Endpoints ====================


@app.post("/api/sms/send", dependencies=INTERNAL)
async def send_sms(sms_request: SMSRequestBody):
    """Send an SMS. Authenticated: an open relay here is billable fraud and a
    smishing vector under the sender ID registered to this business."""
    sms_service = IntouchSMSService()
    result = sms_service.send_sms(sms_request.phone_number, sms_request.message)

    if not result["success"]:
        logger.warning("SMS send failed: %s", result.get("error"))
        raise HTTPException(status_code=400, detail="Message could not be sent.")

    return result


@app.post("/api/sms/payment-confirmation", dependencies=INTERNAL)
async def send_payment_confirmation(sms_request: PaymentConfirmationSMSBody):
    """Send payment confirmation SMS."""
    sms_service = IntouchSMSService()
    result = sms_service.send_payment_confirmation(
        phone_number=sms_request.phone_number,
        tenant_name=sms_request.tenant_name,
        amount=sms_request.amount,
        apartment=sms_request.apartment,
        month=sms_request.month,
        reference_id=sms_request.reference_id,
    )

    if not result["success"]:
        logger.warning("Confirmation SMS failed: %s", result.get("error"))
        raise HTTPException(status_code=400, detail="Message could not be sent.")

    return result


@app.post("/api/sms/payment-reminder", dependencies=INTERNAL)
async def send_payment_reminder(sms_request: PaymentReminderSMSBody):
    """Send payment reminder SMS."""
    sms_service = IntouchSMSService()
    result = sms_service.send_payment_reminder(
        phone_number=sms_request.phone_number,
        tenant_name=sms_request.tenant_name,
        amount=sms_request.amount,
        apartment=sms_request.apartment,
        due_date=sms_request.due_date,
    )

    if not result["success"]:
        logger.warning("Reminder SMS failed: %s", result.get("error"))
        raise HTTPException(status_code=400, detail="Message could not be sent.")

    return result


# ==================== Webhook Endpoints ====================


@app.post("/api/webhooks/payment", dependencies=[Depends(enforce_body_limit)])
async def payment_webhook(request_data: dict):
    """
    Callback from IntouchPay when a transaction settles.

    NOTE: this endpoint cannot use the internal key — IntouchPay does not know
    it. It is therefore UNAUTHENTICATED and must stay side-effect-free until a
    provider signature check is implemented. Do not add database writes here
    without one; see "Open questions" in the security report.
    """
    # Log identifiers only. The raw payload may carry the payer's phone number,
    # so it is not printed wholesale the way it was before.
    logger.info(
        "Payment webhook received: tx=%s status=%s",
        request_data.get("transactionid") or request_data.get("transaction_id"),
        request_data.get("status"),
    )
    return {"message": "Webhook received successfully", "success": True}


if __name__ == "__main__":
    import uvicorn

    # Bind to loopback by default. The previous 0.0.0.0 default published an
    # unauthenticated payment API to every interface on the host. Override with
    # BIND_HOST only when something in front of it terminates TLS and auth.
    uvicorn.run(
        app,
        host=os.getenv("BIND_HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        # Uvicorn's own body/header caps, so malformed traffic is dropped early.
        limit_concurrency=100,
        timeout_keep_alive=15,
    )
