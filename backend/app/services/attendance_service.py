"""Attendance service — CRUD operations with Google Sheets or in-memory fallback."""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from backend.app.core.config import settings
from backend.app.services.user_service import get_internal_user_id, is_owner_role
from sheets.repositories.headers import ATTENDANCE_HEADERS

logger = logging.getLogger(__name__)

_memory_store: Optional[Any] = None


def _get_repo():
    spreadsheet_id = settings.GOOGLE_SHEETS_SPREADSHEET_ID
    if not spreadsheet_id:
        return _get_memory_store()
    try:
        from sheets.repositories.attendance import AttendanceRepository
        return AttendanceRepository(spreadsheet_id=spreadsheet_id)
    except ImportError:
        return _get_memory_store()


def _get_memory_store():
    global _memory_store
    if _memory_store is None:
        from sheets.repositories.memory import InMemoryRepository
        _memory_store = InMemoryRepository(ATTENDANCE_HEADERS)
    return _memory_store


def _user_filter(records: list[dict], user_id: Optional[str]) -> list[dict]:
    if not user_id:
        return records
    return [r for r in records if r.get("user_id", "") in ("", user_id)]


def list_attendance(course_id: Optional[str] = None, date: Optional[str] = None,
                    telegram_id: Optional[int] = None, role: Optional[str] = None) -> list[dict]:
    """Get attendance records, filtered by user_id for non-Owner users."""
    repo = _get_repo()
    try:
        records = repo.get_all()
        if not is_owner_role(role or "") and telegram_id is not None:
            user_id = get_internal_user_id(telegram_id)
            records = _user_filter(records, user_id)
        if course_id:
            records = [r for r in records if r.get("course_id", "") == course_id]
        if date:
            records = [r for r in records if r.get("date", "") == date]
        return records
    except Exception as e:
        logger.error(f"Failed to list attendance: {e}")
        return []


def get_student_attendance(student_id: str, telegram_id: Optional[int] = None, role: Optional[str] = None) -> list[dict]:
    """Get attendance records for a student. Filtered by user_id for non-Owner users."""
    repo = _get_repo()
    try:
        records = repo.find(student_id=student_id)
        if not is_owner_role(role or "") and telegram_id is not None:
            user_id = get_internal_user_id(telegram_id)
            records = _user_filter(records, user_id)
        return records
    except Exception as e:
        logger.error(f"Failed to get attendance for student {student_id}: {e}")
        return []


def mark_attendance(data: dict, telegram_id: Optional[int] = None) -> Optional[dict]:
    """Create or update an attendance record (upsert).

    If a record already exists for the same student/course/date (or lesson_id),
    it updates instead of duplicating.
    If telegram_id is provided, resolves the internal user_id for new records.
    """
    student_id = data.get("student_id", "")
    course_id = data.get("course_id", "")
    date = data.get("date", "")
    lesson_id = data.get("lesson_id", "")

    if not student_id:
        logger.warning("Missing student_id for attendance")
        return None
    if not any([lesson_id, course_id and date]):
        logger.warning("Missing lesson_id or (course_id+date) for attendance")
        return None

    repo = _get_repo()
    now = datetime.now(timezone.utc).isoformat()

    # Upsert: check for existing record (by lesson_id or course_id+date)
    try:
        if lesson_id:
            existing = repo.find(student_id=student_id, lesson_id=lesson_id)
        else:
            existing = repo.find(student_id=student_id, course_id=course_id, date=date)
        if existing:
            record_id = existing[0]["id"]
            update_data = {
                "status": data.get("status", "present"),
                "comment": data.get("comment", ""),
                "marked_by": str(data.get("marked_by", "")),
            }
            if lesson_id:
                update_data["lesson_id"] = lesson_id
            repo.update(record_id, update_data)
            return repo.get_by_id(record_id)
    except Exception as e:
        logger.warning(f"Error checking existing attendance: {e}")

    # Create new record
    record = {
        "id": data.get("id", ""),
        "lesson_id": lesson_id,
        "date": date or "",
        "course_id": course_id or "",
        "student_id": student_id,
        "status": data.get("status", "present"),
        "comment": data.get("comment", ""),
        "marked_by": str(data.get("marked_by", "")),
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
        logger.error(f"Failed to mark attendance: {e}")
        return None


def update_attendance(attendance_id: str, data: dict, telegram_id: Optional[int] = None, role: Optional[str] = None) -> bool:
    """Update an attendance record. Checks ownership and never allows changing the owner (user_id)."""
    data.pop("user_id", None)
    repo = _get_repo()
    try:
        existing = repo.get_by_id(attendance_id)
        if not existing:
            return False
        if not is_owner_role(role or "") and telegram_id is not None:
            user_id = get_internal_user_id(telegram_id)
            if not user_id or existing.get("user_id", "") not in ("", user_id):
                return False
        return repo.update(attendance_id, data)
    except Exception as e:
        logger.error(f"Failed to update attendance {attendance_id}: {e}")
        return False


def list_attendance_by_lesson(lesson_id: str, telegram_id: Optional[int] = None, role: Optional[str] = None) -> list[dict]:
    """Get attendance records for a lesson. Filtered by user_id for non-Owner users."""
    repo = _get_repo()
    try:
        records = repo.find(lesson_id=lesson_id)
        if not is_owner_role(role or "") and telegram_id is not None:
            user_id = get_internal_user_id(telegram_id)
            records = _user_filter(records, user_id)
        return records
    except Exception as e:
        logger.error(f"Failed to get attendance for lesson {lesson_id}: {e}")
        return []
