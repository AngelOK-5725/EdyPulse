"""Lesson service — CRUD + auto-generation from Course schedule."""

import logging
from datetime import date, datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from backend.app.core.config import settings
from sheets.repositories.headers import LESSONS_HEADERS

logger = logging.getLogger(__name__)

_memory_store: Optional[Any] = None


def _get_repo():
    spreadsheet_id = settings.GOOGLE_SHEETS_SPREADSHEET_ID
    if not spreadsheet_id:
        return _get_memory_store()
    try:
        from sheets.repositories.lessons import LessonsRepository
        return LessonsRepository(spreadsheet_id=spreadsheet_id)
    except ImportError:
        return _get_memory_store()


def _get_memory_store():
    global _memory_store
    if _memory_store is None:
        from sheets.repositories.memory import InMemoryRepository
        _memory_store = InMemoryRepository(LESSONS_HEADERS)
    return _memory_store


def _parse_ids(ids_str: str) -> list[str]:
    """Parse a comma-separated string into a list, filtering empties."""
    return [x.strip() for x in ids_str.split(",") if x.strip()]


# ─── CRUD ───────────────────────────────────────────────────────────────────


def list_lessons(date_str: Optional[str] = None, course_id: Optional[str] = None) -> list[dict]:
    """List lessons, optionally filtered by date and/or course."""
    repo = _get_repo()
    try:
        lessons = repo.get_all()
        active = [l for l in lessons if l.get("is_active", "true") == "true"]
        if date_str:
            active = [l for l in active if l.get("date", "") == date_str]
        if course_id:
            active = [l for l in active if l.get("course_id", "") == course_id]
        return sorted(active, key=lambda l: (l.get("date", ""), l.get("time", "")))
    except Exception as e:
        logger.error(f"Failed to list lessons: {e}")
        return []


def get_lesson(lesson_id: str) -> Optional[dict]:
    """Get a lesson by ID."""
    repo = _get_repo()
    try:
        return repo.get_by_id(lesson_id)
    except Exception as e:
        logger.error(f"Failed to get lesson {lesson_id}: {e}")
        return None


def create_lesson(data: dict) -> Optional[dict]:
    """Create a lesson manually."""
    repo = _get_repo()
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "id": data.get("id", ""),
        "course_id": data.get("course_id", ""),
        "date": data.get("date", ""),
        "time": data.get("time", ""),
        "title": data.get("title", ""),
        "status": data.get("status", "scheduled"),
        "rescheduled_to": data.get("rescheduled_to", ""),
        "homework": data.get("homework", ""),
        "location": data.get("location", ""),
        "location_link": data.get("location_link", ""),
        "note": data.get("note", ""),
        "is_active": "true",
        "created_at": now,
    }
    try:
        return repo.create(record)
    except Exception as e:
        logger.error(f"Failed to create lesson: {e}")
        return None


def update_lesson(lesson_id: str, data: dict) -> bool:
    """Update a lesson."""
    repo = _get_repo()
    try:
        return repo.update(lesson_id, data)
    except Exception as e:
        logger.error(f"Failed to update lesson {lesson_id}: {e}")
        return False


def delete_lesson(lesson_id: str) -> bool:
    """Soft-delete a lesson."""
    repo = _get_repo()
    try:
        return repo.delete(lesson_id)
    except Exception as e:
        logger.error(f"Failed to delete lesson {lesson_id}: {e}")
        return False


# ─── Auto-generation ────────────────────────────────────────────────────────


def ensure_lesson_for_course(course: dict, target_date: str) -> Optional[dict]:
    """Auto-create a Lesson if one doesn't exist for this course+date.

    Called when a teacher opens a lesson page or when dashboard loads.
    Returns existing or new lesson.
    """
    repo = _get_repo()
    try:
        existing = repo.find(course_id=course.get("id", ""), date=target_date)
        if existing:
            return existing[0]

        # Create from course template with unique ID
        lesson = create_lesson({
            "id": f"lesson_{uuid4().hex[:8]}",
            "course_id": course.get("id", ""),
            "date": target_date,
            "time": course.get("time", ""),
            "title": course.get("title", ""),
            "status": "scheduled",
            "location": course.get("location", ""),
            "location_link": course.get("location_link", ""),
        })
        return lesson
    except Exception as e:
        logger.error(f"Failed to ensure lesson for {course.get('id')} on {target_date}: {e}")
        return None


def ensure_today_lessons(courses: list[dict]) -> list[dict]:
    """Ensure lessons exist for all courses that have class today.

    Returns the list of today's lessons.
    """
    today_str = date.today().isoformat()
    weekday_map = {
        0: "Пн", 1: "Вт", 2: "Ср", 3: "Чт",
        4: "Пт", 5: "Сб", 6: "Вс",
    }
    today_weekday = weekday_map[date.today().weekday()]

    lessons = []
    for course in courses:
        days_str = course.get("days", "")
        if not days_str:
            continue
        days = [d.strip() for d in days_str.split(",")]
        if today_weekday not in days:
            continue

        lesson = ensure_lesson_for_course(course, today_str)
        if lesson:
            lessons.append(lesson)

    return lessons


# ─── Enrichment: add attendance and student info to lessons ─────────────────


def enrich_lesson_with_attendance(
    lesson: dict,
    all_students: list[dict],
    attendance_records: list[dict],
) -> dict:
    """Merge attendance stats and student info into a lesson dict."""
    lesson_id = lesson.get("id", "")
    course_id = lesson.get("course_id", "")
    lesson_date = lesson.get("date", "")

    # Get course color
    from backend.app.services.course_service import get_course
    course = get_course(course_id) if course_id else None
    course_color = course.get("color", "#6C5CE7") if course else "#6C5CE7"

    # Students enrolled in the course
    course_students = _course_students(course_id, all_students)

    # Attendance for this lesson (by lesson_id or by course_id+date)
    lesson_attendance = [
        a for a in attendance_records
        if a.get("lesson_id", "") == lesson_id
        or (a.get("course_id", "") == course_id and a.get("date", "") == lesson_date)
    ]

    att_map = {a["student_id"]: a for a in lesson_attendance}

    present = sum(1 for s in course_students if att_map.get(s.get("id"), {}).get("status") == "present")
    late = sum(1 for s in course_students if att_map.get(s.get("id"), {}).get("status") == "late")
    absent = sum(1 for s in course_students if att_map.get(s.get("id"), {}).get("status") == "absent")
    trial = sum(1 for s in course_students if att_map.get(s.get("id"), {}).get("status") == "trial")
    unmarked = len(course_students) - len(lesson_attendance)

    unmarked_students = [
        {"id": s.get("id"), "first_name": s.get("first_name", ""), "last_name": s.get("last_name", "")}
        for s in course_students
        if s.get("id") not in att_map
    ]

    return {
        **lesson,
        "color": course_color,
        "student_count": len(course_students),
        "attendance_stats": {
            "present": present,
            "late": late,
            "absent": absent,
            "trial": trial,
            "unmarked": unmarked,
            "total_marked": len(lesson_attendance),
        },
        "unmarked_students": unmarked_students,
    }


def _course_students(course_id: str, all_students: list[dict]) -> list[dict]:
    """Get students enrolled in a course from the course's student_ids."""
    from backend.app.services.course_service import get_course
    course = get_course(course_id)
    if not course:
        return []
    ids_str = course.get("student_ids", "")
    enrolled_ids = _parse_ids(ids_str)
    return [s for s in all_students if s.get("id") in enrolled_ids and s.get("is_active", "true") == "true"]
