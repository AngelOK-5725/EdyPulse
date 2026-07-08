"""Student service — CRUD operations with Google Sheets or in-memory fallback."""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from backend.app.core.config import settings
from sheets.repositories.headers import STUDENTS_HEADERS

logger = logging.getLogger(__name__)

_memory_store: Optional[Any] = None


def _get_repo():
    spreadsheet_id = settings.GOOGLE_SHEETS_SPREADSHEET_ID
    if not spreadsheet_id:
        return _get_memory_store()
    try:
        from sheets.repositories.students import StudentsRepository
        return StudentsRepository(spreadsheet_id=spreadsheet_id)
    except ImportError:
        return _get_memory_store()


def _get_memory_store():
    global _memory_store
    if _memory_store is None:
        from sheets.repositories.memory import InMemoryRepository
        _memory_store = InMemoryRepository(STUDENTS_HEADERS)
    return _memory_store


def list_students(course_id: Optional[str] = None) -> list[dict]:
    """Get all active students, optionally filtered by course."""
    repo = _get_repo()
    try:
        students = repo.get_all()
        active = [s for s in students if s.get("is_active", "true") == "true"]
        if course_id:
            return [s for s in active if course_id in s.get("course_ids", "").split(",")]
        return active
    except Exception as e:
        logger.error(f"Failed to list students: {e}")
        return []


def get_student(student_id: str) -> Optional[dict]:
    repo = _get_repo()
    try:
        return repo.get_by_id(student_id)
    except Exception as e:
        logger.error(f"Failed to get student {student_id}: {e}")
        return None


def create_student(data: dict) -> Optional[dict]:
    repo = _get_repo()
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "id": data.get("id", ""),
        "first_name": data.get("first_name", ""),
        "last_name": data.get("last_name", ""),
        "age": str(data.get("age", "")),
        "birth_date": data.get("birth_date", ""),
        "parent_contact": data.get("parent_contact", ""),
        "parent_name": data.get("parent_name", ""),
        "parent_relation": data.get("parent_relation", ""),
        "phone": data.get("phone", ""),
        "telegram": data.get("telegram", ""),
        "course_ids": _normalize_course_ids(data.get("course_ids", "")),
        "start_date": data.get("start_date", ""),
        "photo_url": data.get("photo_url", ""),
        "is_active": "true",
        "created_at": now,
    }
    try:
        return repo.create(record)
    except Exception as e:
        logger.error(f"Failed to create student: {e}")
        return None


def update_student(student_id: str, data: dict) -> bool:
    repo = _get_repo()
    try:
        return repo.update(student_id, data)
    except Exception as e:
        logger.error(f"Failed to update student {student_id}: {e}")
        return False


def _normalize_course_ids(course_ids: Any) -> str:
    """Normalize course_ids to a comma-separated string.

    Accepts: "course_1,course_2" or ["course_1", "course_2"] or "".
    """
    if isinstance(course_ids, list):
        return ",".join(str(cid).strip() for cid in course_ids if cid)
    if isinstance(course_ids, str):
        return course_ids
    return ""


def delete_student(student_id: str) -> bool:
    repo = _get_repo()
    try:
        return repo.delete(student_id)
    except Exception as e:
        logger.error(f"Failed to delete student {student_id}: {e}")
        return False


def search_students(query: str) -> list[dict]:
    """Search active students by name (case-insensitive partial match on first_name or last_name)."""
    repo = _get_repo()
    try:
        students = repo.get_all()
        active = [s for s in students if s.get("is_active", "true") == "true"]
        if not query:
            return active[:20]  # return first 20 if no query
        q = query.lower().strip()
        results = []
        for s in active:
            first = s.get("first_name", "").lower()
            last = s.get("last_name", "").lower()
            full = f"{first} {last}"
            if q in first or q in last or q in full:
                results.append(s)
        return results[:20]
    except Exception as e:
        logger.error(f"Failed to search students: {e}")
        return []
