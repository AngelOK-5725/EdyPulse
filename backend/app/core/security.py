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
from fastapi import Depends, Header, HTTPException, Request, status
from jwt.exceptions import PyJWTError

from backend.app.core.config import settings
from backend.app.models.user import UserRole

logger = logging.getLogger(__name__)


# ─── Telegram initData Validation ───────────────────────────────────────────


def _parse_raw_pairs(init_data: str) -> dict[str, str]:
    """Parse initData into raw key=value pairs WITHOUT URL-decoding.

    DIAGNOSTIC VERIFICATION (this function does NOT):
      - call unquote()
      - call parse_qs()
      - replace '+' with space
      - modify %2F or any other percent-encoding
      - sort fields
      - remove any characters from values

    The HMAC validation must use the raw (URL-encoded) values as-is,
    because Telegram computes the hash over the original query string,
    not the decoded values.
    """
    result = {}

    # ── DIAG: show each raw part immediately after split('&'), before ANY parsing ──
    raw_parts = init_data.split("&")
    logger.info("DIAG_PARSE: _parse_raw_pairs() called — split('&') produced %d part(s)", len(raw_parts))
    for i, part in enumerate(raw_parts):
        logger.info("DIAG_PARSE:   RAW PART[%d]: %s", i, part)  # plain string, no repr — show exactly what split gives

    for pair in raw_parts:
        if "=" not in pair:
            logger.info("DIAG_PARSE:   SKIP (no '='): %s", pair)
            continue
        key, value = pair.split("=", 1)
        # ── DIAG: show every key with repr(value) and len(value) ────────────
        logger.info(
            "DIAG_PARSE: key=%r | repr(value)=%r | len=%d",
            key, value, len(value)
        )
        result[key] = value  # Keep raw — no unquote!

    return result


def _hmac_sha256(key: bytes, msg: bytes) -> bytes:
    """Compute HMAC-SHA256."""
    return hmac.new(key, msg, hashlib.sha256).digest()


def validate_telegram_init_data(init_data: str) -> Optional[dict]:
    """Validate Telegram WebApp init data using HMAC-SHA256.

    Per Telegram specification:
      1. Remove 'hash' from init_data (it's the expected signature).
         Also exclude any non-standard fields like 'signature' that
         client-side SDKs may append.
      2. Sort remaining key-value pairs alphabetically.
      3. Join as 'key=value' separated by newline → data_check_string.
      4. Compute secret_key = HMAC-SHA256(key="WebAppData", msg=bot_token).
         NOTE: key = "WebAppData" (literal), msg = bot_token.
      5. Compute signature = HMAC-SHA256(key=secret_key, msg=data_check_string).
      6. Compare to received hash.

    Returns the parsed data dict with DECODED values if valid, None otherwise.
    """
    bot_token = settings.TELEGRAM_BOT_TOKEN.strip()

    # ── TRACE: raw init_data before any parsing ─────────────────────────────
    logger.info(
        "VALIDATE_TRACE: validate_telegram_init_data() called — "
        f"init_data length={len(init_data) if init_data else 0} | "
        f"init_data[:200]={init_data[:200]!r}..."
    )

    if not bot_token:
        logger.warning("TELEGRAM_BOT_TOKEN not configured — skipping validation")
        if not init_data:
            return None
        # In dev mode, parse and decode what we can
        raw = _parse_raw_pairs(init_data)
        return {k: unquote(v) for k, v in raw.items()}

    # ── TRACE: bot_token preview ────────────────────────────────────────────
    logger.info(
        "VALIDATE_TRACE: TELEGRAM_BOT_TOKEN — "
        f"bot_token[:10]={bot_token[:10]!r} | "
        f"bot_token length={len(bot_token)}"
    )

    if not init_data:
        return None

    try:
        raw_pairs = _parse_raw_pairs(init_data)

        # ── TRACE: all keys after _parse_raw_pairs ─────────────────────────
        logger.info(
            "VALIDATE_TRACE: raw keys after _parse_raw_pairs() — "
            f"sorted(raw_pairs.keys())={sorted(raw_pairs.keys())}"
        )

        # ── DIAG: repr of every value returned by _parse_raw_pairs ─────────
        for k, v in sorted(raw_pairs.items()):
            logger.info(
                "DIAG_PARSE_POST: key=%r | repr(value)=%r | len=%d",
                k, v, len(v)
            )

        # ── TRACE: does "signature" exist? ──────────────────────────────────
        logger.info(
            "VALIDATE_TRACE: signature field check — "
            f"'signature' in raw_pairs={('signature' in raw_pairs)} | "
            f"raw_pairs.get('signature')={raw_pairs.get('signature', 'NOT_FOUND')!r}"
        )

        # --- Извлечение hash ---
        received_hash = raw_pairs.pop("hash", None)
        if not received_hash:
            logger.warning("VALIDATE_TRACE: no 'hash' field in raw_pairs — aborting")
            return None

        # ═══════════════════════════════════════════════════════════════════
        # Валидация HMAC по спецификации Telegram Mini App
        # ═══════════════════════════════════════════════════════════════════
        #
        #   1. Удалить 'hash' (но НЕ 'signature' — он участвует в подсчёте!)
        #   2. URL-decode все значения
        #   3. Отсортировать ключи A→Z
        #   4. Соединить как 'key=value' через \n → data_check_string
        #   5. secret_key = HMAC-SHA256(key="WebAppData", msg=bot_token)
        #   6. signature = HMAC-SHA256(key=secret_key, msg=data_check_string)
        #   7. Сравнить hex-дайджест с полученным hash
        # ═══════════════════════════════════════════════════════════════════
        #
        # Диагностика (debug_telegram_auth.py) показала рабочую комбинацию:
        #   secret_key = hmac_wa_tok  → HMAC(key="WebAppData", msg=bot_token)
        #   dcs_variant = dec_lf_sig  → URL-decoded, \n, WITH signature
        # ═══════════════════════════════════════════════════════════════════

        # ВАЖНО: signature НЕ удаляем — он участвует в подсчёте хэша!

        # URL-decode значения, сортируем и соединяем через \n
        data_check_string = "\n".join(
            f"{k}={unquote(v)}" for k, v in sorted(raw_pairs.items())
        )

        # secret_key = HMAC-SHA256(key="WebAppData", msg=bot_token)
        secret_key = _hmac_sha256("WebAppData".encode(), bot_token.encode())

        # Вычисляем ожидаемую подпись
        computed_hash = _hmac_sha256(secret_key, data_check_string.encode()).hex()

        # Сравнение
        if computed_hash != received_hash:
            logger.warning(
                "Telegram init data hash mismatch. "
                "Expected %s, got %s. "
                "Run debug_telegram_auth.py locally with real initData to diagnose.",
                computed_hash, received_hash
            )
            return None

        logger.info("VALIDATE_HMAC: hash MATCH — initData is valid")

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
    request: Request = None,
) -> AuthUser:
    """FastAPI dependency: extract current user from JWT in Authorization header.

    Expects header: Authorization: Bearer <token>
    When DEBUG=True and no auth header is provided, returns a default admin user
    for local development without Telegram.
    """
    # ── TRACE: Authorization header check ────────────────────────────────────
    endpoint_path = request.url.path if request else "unknown"
    http_method = request.method if request else "unknown"

    if authorization is None:
        logger.info(
            f"AUTH_TRACE: get_current_user() called — "
            f"Authorization header = None | "
            f"endpoint={http_method} {endpoint_path} | "
            f"request origin={request.headers.get('origin', 'N/A') if request else 'N/A'} | "
            f"referer={request.headers.get('referer', 'N/A') if request else 'N/A'} | "
            f"user-agent={request.headers.get('user-agent', 'N/A') if request else 'N/A'}"
        )
    elif authorization == "":
        logger.info(
            f"AUTH_TRACE: get_current_user() called — "
            f"Authorization header = EMPTY STRING '' | "
            f"endpoint={http_method} {endpoint_path} | "
            f"origin={request.headers.get('origin', 'N/A') if request else 'N/A'}"
        )
    else:
        token_preview = authorization[:20] + "..." if len(authorization) > 20 else authorization
        logger.info(
            f"AUTH_TRACE: get_current_user() called — "
            f"Authorization header PRESENT | "
            f"first 20 chars: {token_preview!r} | "
            f"endpoint={http_method} {endpoint_path}"
        )

    # ── Detect OPTIONS/preflight ─────────────────────────────────────────────
    if request and request.method == "OPTIONS":
        logger.info(
            f"AUTH_TRACE: OPTIONS preflight detected — "
            f"endpoint={endpoint_path} | "
            f"origin={request.headers.get('origin', 'N/A')}"
        )
        # CORSMiddleware should handle OPTIONS before reaching here,
        # but if it arrives, we still process it

    # ── Страховка: если Authorization — пустая строка, считаем что его нет ──
    # Фронтенд может случайно отправить Authorization: "" вместо того чтобы
    # не отправлять заголовок вообще (см. api.login в frontend/src/services/api.ts).
    if not authorization or authorization.strip() == "":
        if settings.DEBUG and settings.ALLOW_DEBUG_FALLBACK:
            logger.warning(
                f"AUTH_TRACE: >>> ENTERING DEBUG FALLBACK <<< | "
                f"No Authorization header, DEBUG={settings.DEBUG} and "
                f"ALLOW_DEBUG_FALLBACK={settings.ALLOW_DEBUG_FALLBACK} | "
                f"Method={http_method} | URL={endpoint_path} | "
                f"Origin={request.headers.get('origin', 'N/A') if request else 'N/A'} | "
                f"Referer={request.headers.get('referer', 'N/A') if request else 'N/A'} | "
                f"User-Agent={request.headers.get('user-agent', 'N/A') if request else 'N/A'}"
            )
            # Dev mode: allow requests without auth
            return AuthUser(telegram_id=0, role=UserRole.ADMIN)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        logger.warning(
            f"AUTH_TRACE: Invalid Authorization scheme — "
            f"scheme={scheme!r} | token empty={not token} | "
            f"endpoint={http_method} {endpoint_path}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Use: Bearer <token>",
        )

    payload = decode_access_token(token)
    if payload is None:
        logger.warning(
            f"AUTH_TRACE: JWT decode FAILED — "
            f"token preview={token[:20] + '...' if len(token) > 20 else token!r} | "
            f"endpoint={http_method} {endpoint_path}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    # JWT decode SUCCESS — log payload
    telegram_id = int(payload.get("sub", "0"))
    role_str = payload.get("role", "user")
    exp_ts = payload.get("exp", 0)
    exp_str = datetime.fromtimestamp(exp_ts, tz=timezone.utc).isoformat() if exp_ts else "unknown"
    now_ts = int(time.time())
    is_expired = now_ts > exp_ts if exp_ts else False

    logger.info(
        f"AUTH_TRACE: JWT decode SUCCESS — "
        f"sub(telegram_id)={telegram_id} | role={role_str} | "
        f"expires={exp_str} | expired={is_expired} | "
        f"endpoint={http_method} {endpoint_path}"
    )

    try:
        role = UserRole(role_str)
    except ValueError:
        logger.warning(f"AUTH_TRACE: Unknown role string {role_str!r}, falling back to USER")
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
