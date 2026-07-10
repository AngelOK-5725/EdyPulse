"""Course service — CRUD operations with Google Sheets or in-memory fallback."""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from backend.app.core.config import settings
from sheets.repositories.headers import COURSES_HEADERS

logger = logging.getLogger(__name__)

_memory_store: Optional[Any] = None


def _get_repo():
    spreadsheet_id = settings.GOOGLE_SHEETS_SPREADSHEET_ID
    if not spreadsheet_id:
        return _get_memory_store()
    try:
        from sheets.repositories.courses import CoursesRepository
        return CoursesRepository(spreadsheet_id=spreadsheet_id)
    except ImportError:
        return _get_memory_store()


def _get_memory_store():
    global _memory_store
    if _memory_store is None:
        from sheets.repositories.memory import InMemoryRepository
        _memory_store = InMemoryRepository(COURSES_HEADERS)
    return _memory_store


def list_courses() -> list[dict]:
    """Get all active courses."""
    repo = _get_repo()
    try:
        courses = repo.get_all()
        return [c for c in courses if c.get("is_active", "true") == "true"]
    except Exception as e:
        logger.error(f"Failed to list courses: {e}")
        return []


def get_course(course_id: str) -> Optional[dict]:
    """Get a course by ID."""
    repo = _get_repo()
    try:
        return repo.get_by_id(course_id)
    except Exception as e:
        logger.error(f"Failed to get course {course_id}: {e}")
        return None


def create_course(data: dict, telegram_id: Optional[int] = None) -> Optional[dict]:
    """Create a new course.

    If telegram_id is provided, resolves the internal user_id
    and records it as the owner of this course record.
    """
    repo = _get_repo()
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "id": data.get("id", ""),
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "days": data.get("days", ""),
        "time": data.get("time", ""),
        "price": str(data.get("price", 0)),
        "teacher_id": str(data.get("teacher_id", "")),
        "color": data.get("color", "#6C5CE7"),
        "student_ids": data.get("student_ids", ""),
        "location": data.get("location", ""),
        "location_link": data.get("location_link", ""),
        "is_active": "true",
        "created_at": now,
        # Tariff fields
        "monthly_price": str(data.get("monthly_price", "")) if data.get("monthly_price") else "",
        "lesson_price": str(data.get("lesson_price", "")) if data.get("lesson_price") else "",
        "lessons_per_week": str(data.get("lessons_per_week", "")) if data.get("lessons_per_week") else "",
        "payment_type": data.get("payment_type", "monthly"),
    }
    # Record the owner if we have a telegram_id
    if telegram_id is not None:
        from backend.app.services.user_service import _resolve_user_id
        owner_id = _resolve_user_id(telegram_id)
        if owner_id:
            record["user_id"] = owner_id
    try:
        return repo.create(record)
    except Exception as e:
        logger.error(f"Failed to create course: {e}")
        return None


def update_course(course_id: str, data: dict) -> bool:
    """Update a course. Never allows changing the owner (user_id)."""
    data.pop("user_id", None)
    repo = _get_repo()
    try:
        return repo.update(course_id, data)
    except Exception as e:
        logger.error(f"Failed to update course {course_id}: {e}")
        return False


def delete_course(course_id: str) -> bool:
    """Soft-delete a course."""
    repo = _get_repo()
    try:
        return repo.delete(course_id)
    except Exception as e:
        logger.error(f"Failed to delete course {course_id}: {e}")
        return False


def enroll_student(course_id: str, student_id: str) -> bool:
    """Enroll an existing student in a course (updates both course.student_ids and student.course_ids)."""
    from backend.app.services.student_service import get_student, update_student

    course = get_course(course_id)
    student = get_student(student_id)
    if not course or not student:
        return False

    # Update course.student_ids
    current_student_ids = _parse_ids(course.get("student_ids", ""))
    if student_id not in current_student_ids:
        current_student_ids.append(student_id)
        course_ok = update_course(course_id, {"student_ids": ",".join(current_student_ids)})
    else:
        course_ok = True

    # Update student.course_ids
    current_course_ids = _parse_ids(student.get("course_ids", ""))
    if course_id not in current_course_ids:
        current_course_ids.append(course_id)
        student_ok = update_student(student_id, {"course_ids": ",".join(current_course_ids)})
    else:
        student_ok = True

    return course_ok and student_ok


def unenroll_student(course_id: str, student_id: str) -> bool:
    """Unenroll a student from a course (updates both sides)."""
    from backend.app.services.student_service import get_student, update_student

    course = get_course(course_id)
    student = get_student(student_id)
    if not course or not student:
        return False

    # Update course.student_ids
    current_student_ids = _parse_ids(course.get("student_ids", ""))
    if student_id in current_student_ids:
        current_student_ids.remove(student_id)
        course_ok = update_course(course_id, {"student_ids": ",".join(current_student_ids)})
    else:
        course_ok = True

    # Update student.course_ids
    current_course_ids = _parse_ids(student.get("course_ids", ""))
    if course_id in current_course_ids:
        current_course_ids.remove(course_id)
        student_ok = update_student(student_id, {"course_ids": ",".join(current_course_ids)})
    else:
        student_ok = True

    return course_ok and student_ok


def _parse_ids(ids_str: str) -> list[str]:
    """Parse a comma-separated string of IDs into a list, filtering empties."""
    return [x.strip() for x in ids_str.split(",") if x.strip()]
