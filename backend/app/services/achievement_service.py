"""Achievement service — CRUD operations with Google Sheets or in-memory fallback."""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from backend.app.core.config import settings
from backend.app.services.user_service import get_internal_user_id, is_admin_role

logger = logging.getLogger(__name__)

_memory_store: Optional[Any] = None


def _get_repo():
    spreadsheet_id = settings.GOOGLE_SHEETS_SPREADSHEET_ID
    if not spreadsheet_id:
        return _get_memory_store()
    try:
        from sheets.repositories.achievements import AchievementsRepository
        return AchievementsRepository(spreadsheet_id=spreadsheet_id)
    except ImportError:
        return _get_memory_store()


def _get_memory_store():
    global _memory_store
    if _memory_store is None:
        from sheets.repositories.memory import InMemoryRepository
        from sheets.repositories.achievements import ACHIEVEMENTS_HEADERS
        _memory_store = InMemoryRepository(ACHIEVEMENTS_HEADERS)
    return _memory_store


def _user_filter(records: list[dict], user_id: Optional[str]) -> list[dict]:
    if not user_id:
        return records
    return [r for r in records if r.get("user_id", "") in ("", user_id)]


def list_achievements(student_id: Optional[str] = None, telegram_id: Optional[int] = None, role: Optional[str] = None) -> list[dict]:
    """Get achievements, filtered by user_id for non-Admin+ users."""
    repo = _get_repo()
    try:
        records = repo.get_all()
        if not is_admin_role(role or "") and telegram_id is not None:
            user_id = get_internal_user_id(telegram_id)
            records = _user_filter(records, user_id)
        if student_id:
            return [a for a in records if a.get("student_id", "") == student_id]
        return records
    except Exception as e:
        logger.error(f"Failed to list achievements: {e}")
        return []


def create_achievement(data: dict, telegram_id: Optional[int] = None) -> Optional[dict]:
    """Create an achievement record.

    If telegram_id is provided, resolves the internal user_id
    and records it as the owner of this achievement record.
    """
    repo = _get_repo()
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "id": data.get("id", ""),
        "student_id": data.get("student_id", ""),
        "title": data.get("title", ""),
        "icon": data.get("icon", "🏆"),
        "description": data.get("description", ""),
        "achieved_at": data.get("achieved_at", now),
        "created_at": now,
    }
    # Record the owner if we have a telegram_id
    if telegram_id is not None:
        owner_id = get_internal_user_id(telegram_id)
        if owner_id:
            record["user_id"] = owner_id
    try:
        return repo.create(record)
    except Exception as e:
        logger.error(f"Failed to create achievement: {e}")
        return None


def delete_achievement(achievement_id: str, telegram_id: Optional[int] = None, role: Optional[str] = None) -> bool:
    """Delete an achievement. Checks ownership first."""
    repo = _get_repo()
    try:
        existing = repo.get_by_id(achievement_id)
        if not existing:
            return False
        if not is_admin_role(role or "") and telegram_id is not None:
            user_id = get_internal_user_id(telegram_id)
            if not user_id or existing.get("user_id", "") not in ("", user_id):
                return False
        return repo.delete(achievement_id)
    except Exception as e:
        logger.error(f"Failed to delete achievement {achievement_id}: {e}")
        return False
