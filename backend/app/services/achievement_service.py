"""Achievement service — CRUD operations with Google Sheets or in-memory fallback."""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from backend.app.core.config import settings

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


def list_achievements(student_id: Optional[str] = None) -> list[dict]:
    """Get all achievements, optionally filtered by student."""
    repo = _get_repo()
    try:
        records = repo.get_all()
        if student_id:
            return [a for a in records if a.get("student_id", "") == student_id]
        return records
    except Exception as e:
        logger.error(f"Failed to list achievements: {e}")
        return []


def create_achievement(data: dict) -> Optional[dict]:
    """Create an achievement record."""
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
    try:
        return repo.create(record)
    except Exception as e:
        logger.error(f"Failed to create achievement: {e}")
        return None


def delete_achievement(achievement_id: str) -> bool:
    """Delete an achievement record."""
    repo = _get_repo()
    try:
        return repo.delete(achievement_id)
    except Exception as e:
        logger.error(f"Failed to delete achievement {achievement_id}: {e}")
        return False
