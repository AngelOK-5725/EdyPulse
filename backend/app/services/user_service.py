"""User service — find or create users from Telegram login data."""

import logging
import secrets
from datetime import datetime, timezone
from typing import Optional

from backend.app.core.config import settings

logger = logging.getLogger(__name__)

# NOTE: google.repositories are imported lazily inside _get_users_repo()
# to avoid gspread import errors when Google Sheets is not configured.


def _generate_user_id() -> str:
    """Generate a unique, immutable internal user ID.

    Format: usr_XXXXXXXX (8 uppercase hex characters after prefix).
    Example: usr_A7KD91PQ

    Uses secrets module for cryptographic-quality randomness.
    Uniqueness is ensured by the combination of:
    - 8 hex chars = 4 bytes = 4 294 967 296 possible values
    - Check against existing users in storage at creation time

    This is an internal identifier used as Foreign Key across all tables.
    It is NEVER exposed to Telegram or any external system.
    """
    return f"usr_{secrets.token_hex(4).upper()}"


def _get_users_repo():
    """Get UsersRepository if Google Sheets is configured.

    Uses lazy import so the backend can start without gspread installed.
    Returns None if Google Sheets is not configured.
    """
    spreadsheet_id = settings.GOOGLE_SHEETS_SPREADSHEET_ID
    if not spreadsheet_id:
        return None

    try:
        from sheets.repositories.users import UsersRepository
        return UsersRepository(spreadsheet_id=spreadsheet_id)
    except ImportError as e:
        logger.warning(f"Google Sheets packages not available: {e}")
        return None
    except Exception as e:
        logger.warning(f"Failed to initialise UsersRepository: {e}")
        return None


def find_or_create_user(telegram_data: dict) -> Optional[dict]:
    """Find a user by telegram_id or create a new one.

    `telegram_data` should contain at minimum:
        - telegram_id: int
        - first_name: str
        - last_name: Optional[str]
        - username: Optional[str]
        - photo_url: Optional[str]

    Returns the user dict with all fields, or None on error.
    """
    telegram_id = telegram_data.get("telegram_id")
    if not telegram_id:
        return None

    repo = _get_users_repo()

    if repo:
        # Try to find existing user in Google Sheets
        try:
            existing = repo.find_by_telegram_id(telegram_id)
            if existing:
                logger.info(f"User found: {existing.get('first_name')} (role: {existing.get('role')})")
                return existing
        except Exception as e:
            logger.warning(f"Error finding user in Google Sheets: {e}")
            # Fall through to in-memory store

    # User not found — create new user with generated internal ID
    now = datetime.now(timezone.utc).isoformat()
    new_user_id = _generate_user_id()
    new_user = {
        "id": new_user_id,
        "telegram_id": str(telegram_id),
        "first_name": telegram_data.get("first_name", ""),
        "last_name": telegram_data.get("last_name", ""),
        "username": telegram_data.get("username", ""),
        "photo_url": telegram_data.get("photo_url", ""),
        "role": "user",  # Default role; admin must be assigned manually
        "is_active": "true",
        "created_at": now,
    }

    if repo:
        try:
            repo.create(new_user)
            logger.info(f"New user created in Google Sheets: {new_user['first_name']}")
        except Exception as e:
            logger.error(f"Failed to save user to Google Sheets: {e}")
            # Return the user anyway for in-memory mode
    else:
        logger.info(f"New user (no Google Sheets): {new_user['first_name']}")

    return new_user


def get_user_by_telegram_id(telegram_id: int) -> Optional[dict]:
    """Get a user by telegram ID."""
    repo = _get_users_repo()
    if repo:
        try:
            return repo.find_by_telegram_id(telegram_id)
        except Exception as e:
            logger.warning(f"Error finding user: {e}")
    return None


def update_user_role(telegram_id: int, new_role: str) -> bool:
    """Update a user's role (admin only)."""
    repo = _get_users_repo()
    if repo:
        try:
            return repo.update(str(telegram_id), {"role": new_role}, id_field="telegram_id")
        except Exception as e:
            logger.error(f"Failed to update user role: {e}")
            return False
    return False
