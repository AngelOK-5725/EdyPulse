"""Telegram authentication, JWT tokens, and role-based access control."""

import hashlib
import hmac
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional
from urllib.parse import unquote

import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt.exceptions import PyJWTError

from backend.app.core.config import settings
from backend.app.models.user import UserRole

logger = logging.getLogger(__name__)


# ─── Telegram initData Validation ───────────────────────────────────────────


def _parse_raw_pairs(init_data: str) -> dict[str, str]:
    """Parse initData into raw key=value pairs WITHOUT URL-decoding.

    The HMAC validation must use the raw (URL-encoded) values as-is,
    because Telegram computes the hash over the original query string,
    not the decoded values.
    """
    result = {}
    for pair in init_data.split("&"):
        if "=" not in pair:
            continue
        key, value = pair.split("=", 1)
        result[key] = value  # Keep raw — no unquote!
    return result


def validate_telegram_init_data(init_data: str) -> Optional[dict]:
    """Validate Telegram WebApp init data using HMAC-SHA256.

    NOTE: The data_check_string is built from RAW (URL-encoded) values,
    NOT decoded. URL-decoding happens AFTER validation.

    Returns the parsed data dict with DECODED values if valid, None otherwise.
    """
    bot_token = settings.TELEGRAM_BOT_TOKEN
    if not bot_token:
        logger.warning("TELEGRAM_BOT_TOKEN not configured — skipping validation")
        if not init_data:
            return None
        # In dev mode, parse and decode what we can
        raw = _parse_raw_pairs(init_data)
        return {k: unquote(v) for k, v in raw.items()}

    if not init_data:
        return None

    try:
        raw_pairs = _parse_raw_pairs(init_data)
        received_hash = raw_pairs.pop("hash", None)

        if not received_hash:
            return None

        # Build data-check string from RAW values (no URL decoding!)
        data_check_string = "\n".join(
            f"{k}={v}" for k, v in sorted(raw_pairs.items())
        )

        # HMAC-SHA256 with "WebAppData" as key, then bot_token
        secret_key = hmac.new(
            "WebAppData".encode(), bot_token.encode(), hashlib.sha256
        ).digest()

        computed_hash = hmac.new(
            secret_key, data_check_string.encode(), hashlib.sha256
        ).hexdigest()

        if computed_hash != received_hash:
            logger.warning("Telegram init data hash mismatch")
            return None

        # Validation passed — now decode values for usage
        return {k: unquote(v) for k, v in raw_pairs.items()}
    except Exception as e:
        logger.error(f"Error validating Telegram init data: {e}")
        return None


def extract_user_from_init_data(init_data: str) -> Optional[dict]:
    """Validate initData and extract the user object from it.

    Also verifies that auth_date is within 24 hours to prevent replay attacks.
    """
    parsed = validate_telegram_init_data(init_data)
    if not parsed:
        return None

    # Replay protection: auth_date must be within 24 hours
    auth_date_str = parsed.get("auth_date")
    if auth_date_str and settings.TELEGRAM_BOT_TOKEN:
        try:
            auth_date = int(auth_date_str)
            if time.time() - auth_date > 86400:  # 24 hours
                logger.warning("Telegram init data is too old (replay attack?)")
                return None
        except (ValueError, TypeError):
            logger.warning("Invalid auth_date in Telegram init data")
            return None

    user_raw = parsed.get("user")
    if not user_raw:
        return None

    try:
        user_data = json.loads(user_raw)
        # Normalise snake_case → our model
        return {
            "telegram_id": user_data.get("id"),
            "first_name": user_data.get("first_name", ""),
            "last_name": user_data.get("last_name"),
            "username": user_data.get("username"),
            "photo_url": user_data.get("photo_url"),
            "language_code": user_data.get("language_code"),
            "is_premium": user_data.get("is_premium", False),
        }
    except (json.JSONDecodeError, KeyError) as e:
        logger.error(f"Error parsing Telegram user: {e}")
        return None


# ─── JWT Tokens ─────────────────────────────────────────────────────────────


def create_access_token(
    telegram_id: int,
    role: UserRole,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a JWT access token."""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(hours=settings.JWT_EXPIRATION_HOURS))

    payload = {
        "sub": str(telegram_id),
        "role": role.value,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except PyJWTError as e:
        logger.warning(f"JWT decode error: {e}")
        return None


# ─── FastAPI Dependencies ───────────────────────────────────────────────────


class AuthUser:
    """Represents the authenticated user from the token."""

    def __init__(self, telegram_id: int, role: UserRole):
        self.telegram_id = telegram_id
        self.role = role

    def is_owner(self) -> bool:
        return self.role == UserRole.OWNER

    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN or self.role == UserRole.OWNER

    def is_tester(self) -> bool:
        return self.role == UserRole.TESTER

    def is_admin_or_tester(self) -> bool:
        return self.role in (UserRole.ADMIN, UserRole.TESTER, UserRole.OWNER)


async def get_current_user(
    authorization: Optional[str] = Header(None),
) -> AuthUser:
    """FastAPI dependency: extract current user from JWT in Authorization header.

    Expects header: Authorization: Bearer <token>
    When DEBUG=True and no auth header is provided, returns a default admin user
    for local development without Telegram.
    """
    if not authorization:
        if settings.DEBUG:
            # Dev mode: allow requests without auth
            return AuthUser(telegram_id=0, role=UserRole.ADMIN)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Use: Bearer <token>",
        )

    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    telegram_id = int(payload.get("sub", "0"))
    role_str = payload.get("role", "user")

    try:
        role = UserRole(role_str)
    except ValueError:
        role = UserRole.USER

    return AuthUser(telegram_id=telegram_id, role=role)


def require_role(allowed_roles: list[UserRole]):
    """Factory for role-based access control dependency.

    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(user: AuthUser = Depends(require_role([UserRole.ADMIN]))):
            ...
    """

    async def role_checker(
        current_user: AuthUser = Depends(get_current_user),
    ) -> AuthUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return role_checker


# ─── Owner-only: checks Telegram ID against config ─────────────────────────


async def get_owner_user(
    current_user: AuthUser = Depends(get_current_user),
) -> AuthUser:
    """Check that user is the system owner by Telegram ID."""
    if current_user.telegram_id != settings.OWNER_TELEGRAM_ID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the system owner can access this resource",
        )
    return current_user


# ─── Shorthand dependencies (единая система проверки ролей) ────────────────
#
# TeacherOnly  — USER + ADMIN + OWNER (все, кто имеет доступ к ученикам)
# AdminOnly    — ADMIN + OWNER
# OwnerOnly    — только OWNER (проверка по Telegram ID)
# CurrentUser  — любой аутентифицированный пользователь (базовый доступ)

CurrentUser = Annotated[AuthUser, Depends(get_current_user)]
AdminOnly = Annotated[AuthUser, Depends(require_role([UserRole.ADMIN, UserRole.OWNER]))]
OwnerOnly = Annotated[AuthUser, Depends(get_owner_user)]
