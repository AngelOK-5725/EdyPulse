"""Dashboard service — aggregates data from lessons, not courses."""

import logging
from datetime import date, datetime
from typing import Any, Optional

from backend.app.services.course_service import list_courses
from backend.app.services.student_service import list_students
from backend.app.services.lesson_service import ensure_today_lessons, enrich_lesson_with_attendance
from backend.app.services.attendance_service import list_attendance
from backend.app.services.payment_service import list_payments

logger = logging.getLogger(__name__)


def get_dashboard(telegram_id: Optional[int] = None, role: Optional[str] = None) -> dict[str, Any]:
    """Build the full dashboard response centered on today's lessons."""
    today_str = date.today().isoformat()
    today_weekday = date.today().weekday()
    weekday_names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
    logger.info(f"TRACE_DASHBOARD get_dashboard() — telegram_id={telegram_id}, role={role!r}, "
                f"date={today_str}, weekday={today_weekday}({weekday_names[today_weekday]})")

    courses = list_courses(telegram_id=telegram_id, role=role)
    logger.info(f"TRACE_DASHBOARD get_dashboard() — courses from list_courses: {len(courses)}")
    all_students = list_students(telegram_id=telegram_id, role=role)
    all_payments = list_payments(telegram_id=telegram_id, role=role)

    # ── Today's lessons (auto-created) ─────────────────────────────────────
    today_lessons = ensure_today_lessons(courses, telegram_id=telegram_id)
    logger.info(f"TRACE_DASHBOARD get_dashboard() — today_lessons from ensure_today_lessons: {len(today_lessons)}")
    today_attendance = list_attendance(date=today_str, telegram_id=telegram_id, role=role)

    lessons_with_stats = [
        enrich_lesson_with_attendance(l, all_students, today_attendance)
        for l in today_lessons
    ]

    # ── Next lesson ────────────────────────────────────────────────────────
    now = datetime.now()
    current_time_str = now.strftime("%H:%M")

    next_lesson = None
    for lesson in today_lessons:
        lesson_time = lesson.get("time", "")
        if lesson_time and lesson_time > current_time_str:
            # Find course for color/location
            course = next((c for c in courses if c.get("id") == lesson.get("course_id")), None)
            next_lesson = {
                "id": lesson.get("id"),
                "course_id": lesson.get("course_id"),
                "title": lesson.get("title", ""),
                "time": lesson_time,
                "color": course.get("color", "#6C5CE7") if course else "#6C5CE7",
                "location": lesson.get("location", "") or (course.get("location", "") if course else ""),
                "location_link": lesson.get("location_link", "") or (course.get("location_link", "") if course else ""),
            }
            break

    if not next_lesson and today_lessons:
        last = today_lessons[-1]
        course = next((c for c in courses if c.get("id") == last.get("course_id")), None)
        stats = next((ls.get("attendance_stats", {}) for ls in lessons_with_stats if ls.get("id") == last.get("id")), {})
        next_lesson = {
            "id": last.get("id"),
            "course_id": last.get("course_id"),
            "title": last.get("title", ""),
            "time": last.get("time", ""),
            "color": course.get("color", "#6C5CE7") if course else "#6C5CE7",
            "location": last.get("location", "") or (course.get("location", "") if course else ""),
            "location_link": last.get("location_link", "") or (course.get("location_link", "") if course else ""),
            "status": "current" if stats.get("unmarked", 0) > 0 else "completed",
        }

    # ── Global attendance today ────────────────────────────────────────────
    today_records = {}
    for a in today_attendance:
        sid = a.get("student_id")
        today_records[sid] = a.get("status")

    all_today_students = set()
    for lesson in today_lessons:
        course_id = lesson.get("course_id", "")
        for s in _course_students(course_id, all_students):
            all_today_students.add(s.get("id"))

    global_present = sum(1 for s in all_today_students if today_records.get(s) == "present")
    global_late = sum(1 for s in all_today_students if today_records.get(s) == "late")
    global_absent = sum(1 for s in all_today_students if today_records.get(s) == "absent")
    global_unmarked = len(all_today_students) - len(today_records)

    # ── Summary ────────────────────────────────────────────────────────────
    all_active = [s for s in all_students if s.get("is_active", "true") == "true"]
    unique_students = set(s.get("id") for s in all_active)

    logger.info(
        f"TRACE_DASHBOARD get_dashboard() — RESPONSE: "
        f"today_lessons={len(today_lessons)}, "
        f"next_lesson={'yes' if next_lesson else 'no'}, "
        f"total_students={len(all_today_students)}, "
        f"courses={len(courses)}, "
        f"unique_students={len(unique_students)}"
    )

    return {
        "today": {
            "date": today_str,
            "lessons": lessons_with_stats,
            "next_lesson": next_lesson,
            "total_lessons": len(today_lessons),
            "total_students": len(all_today_students),
            "present": global_present,
            "late": global_late,
            "absent": global_absent,
            "unmarked": global_unmarked,
            "pending_payments": 0,
            "overdue_payments": 0,
            "payment_alerts": [],
        },
        "summary": {
            "total_courses": len(courses),
            "total_students": len(unique_students),
            "total_payments": len(all_payments),
        },
    }


def _course_students(course_id: str, all_students: list[dict]) -> list[dict]:
    """Get students enrolled in a course."""
    from backend.app.services.course_service import get_course
    course = get_course(course_id)
    if not course:
        return []
    ids_str = course.get("student_ids", "")
    enrolled_ids = [x.strip() for x in ids_str.split(",") if x.strip()]
    return [s for s in all_students if s.get("id") in enrolled_ids and s.get("is_active", "true") == "true"]
