"""Attendance service — CRUD operations with Google Sheets or in-memory fallback."""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from backend.app.core.config import settings
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


def list_attendance(course_id: Optional[str] = None, date: Optional[str] = None) -> list[dict]:
    """Get attendance records, optionally filtered by course and/or date."""
    repo = _get_repo()
    try:
        records = repo.get_all()
        if course_id:
            records = [r for r in records if r.get("course_id", "") == course_id]
        if date:
            records = [r for r in records if r.get("date", "") == date]
        return records
    except Exception as e:
        logger.error(f"Failed to list attendance: {e}")
        return []


def get_student_attendance(student_id: str) -> list[dict]:
    """Get all attendance records for a student."""
    repo = _get_repo()
    try:
        return repo.find(student_id=student_id)
    except Exception as e:
        logger.error(f"Failed to get attendance for student {student_id}: {e}")
        return []


def mark_attendance(data: dict) -> Optional[dict]:
    """Create or update an attendance record (upsert).

    If a record already exists for the same student/course/date (or lesson_id),
    it updates instead of duplicating.
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
    try:
        return repo.create(record)
    except Exception as e:
        logger.error(f"Failed to mark attendance: {e}")
        return None


def update_attendance(attendance_id: str, data: dict) -> bool:
    """Update an attendance record."""
    repo = _get_repo()
    try:
        return repo.update(attendance_id, data)
    except Exception as e:
        logger.error(f"Failed to update attendance {attendance_id}: {e}")
        return False


def list_attendance_by_lesson(lesson_id: str) -> list[dict]:
    """Get all attendance records for a lesson."""
    repo = _get_repo()
    try:
        return repo.find(lesson_id=lesson_id)
    except Exception as e:
        logger.error(f"Failed to get attendance for lesson {lesson_id}: {e}")
        return []
