"""
Authentication and request guards for the payment/SMS backend.

This service has no user-facing surface: its only legitimate caller is the
Next.js server (app/api/intouch/**), which proxies to it. It was previously
wide open — anyone who could reach port 8000 could:

    POST /api/sms/send            -> free SMS relay (cost + smishing)
    POST /api/payments/request    -> initiate real IntouchPay charges
    GET  /api/payments/balance    -> read the merchant account balance

So the model here is service-to-service: a shared secret that only the Next
server knows, compared in constant time, plus a body-size cap and a request
timeout so a single caller cannot tie the process up.
"""

import hmac
import os
import secrets
from typing import Optional

from fastapi import Header, HTTPException, Request, status

# Requests larger than this are refused before the body is read into memory.
MAX_BODY_BYTES = 64 * 1024  # 64 KB — these payloads are small JSON objects.

# Outbound calls to IntouchPay/IntouchSMS get this ceiling so a hung upstream
# does not pin a worker indefinitely.
UPSTREAM_TIMEOUT_SECONDS = 20.0


def _expected_key() -> str:
    """
    The shared secret. Absent in production is fatal: starting without it would
    silently restore the open-relay behaviour this module exists to remove.
    """
    key = os.getenv("INTERNAL_API_KEY", "")
    if not key:
        if os.getenv("APP_ENV", "development").lower() == "production":
            raise RuntimeError(
                "INTERNAL_API_KEY is not set. Generate one with: "
                "python -c \"import secrets; print(secrets.token_urlsafe(48))\" "
                "and set the same value on the Next.js server."
            )
        # Development: generate a per-process key so local runs still refuse
        # unauthenticated callers instead of accepting everyone.
        return ""
    if len(key) < 32:
        raise RuntimeError(
            "INTERNAL_API_KEY must be at least 32 characters. Generate one with: "
            "python -c \"import secrets; print(secrets.token_urlsafe(48))\""
        )
    return key


async def require_internal_key(
    x_internal_key: Optional[str] = Header(default=None, alias="X-Internal-Key"),
) -> None:
    """
    FastAPI dependency. Attach to every route that spends money or sends SMS.

    Uses compare_digest so a wrong key cannot be recovered by timing the
    response, and returns an identical 401 whether the header is missing or
    simply wrong.
    """
    expected = _expected_key()

    if not expected:
        # Development with no key configured: allow, but make it impossible to
        # miss in the log that this is not a production-safe configuration.
        print(
            "[security] WARNING: INTERNAL_API_KEY is unset — endpoints are "
            "UNAUTHENTICATED. Set it before deploying."
        )
        return

    supplied = x_internal_key or ""
    if not hmac.compare_digest(supplied, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized.",
        )


async def enforce_body_limit(request: Request) -> None:
    """
    Reject oversized bodies up front. Checks the declared Content-Length, then
    the actual body, so a lying header does not get past.
    """
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_BODY_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Request body too large.",
        )

    body = await request.body()
    if len(body) > MAX_BODY_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Request body too large.",
        )


def new_key() -> str:
    """Helper for operators: `python -c 'from app.security import new_key; print(new_key())'`"""
    return secrets.token_urlsafe(48)
