"""Student profile service — aggregates all data for the student card."""

import logging
from datetime import date, datetime
from typing import Any, Optional

from backend.app.services.student_service import get_student
from backend.app.services.course_service import get_course, list_courses
from backend.app.services.attendance_service import get_student_attendance
from backend.app.services.payment_service import get_student_payments
from backend.app.services.achievement_service import list_achievements

logger = logging.getLogger(__name__)


def get_student_profile(student_id: str) -> Optional[dict[str, Any]]:
    """Get full student profile: info, courses, attendance stats, payments, achievements.

    Returns None if the student is not found.
    """
    student = get_student(student_id)
    if not student:
        return None

    # ── Courses the student is enrolled in ─────────────────────────────────
    enrolled_course_ids = _parse_ids(student.get("course_ids", ""))
    all_courses = list_courses()
    enrolled_courses = [c for c in all_courses if c.get("id") in enrolled_course_ids]

    # ── Payments — simple journal, no balance calculations ────────────────
    payments = get_student_payments(student_id)

    # ── Achievements ───────────────────────────────────────────────────────
    achievements = list_achievements(student_id)

    # ── Attendance ─────────────────────────────────────────────────────────
    attendance_records = get_student_attendance(student_id)
    attendance = _attendance_stats(attendance_records)

    total_paid = sum(float(p.get("amount", 0)) for p in payments)

    return {
        "student": student,
        "courses": enrolled_courses,
        "payments": payments,
        "total_paid": total_paid,
        "achievements": achievements,
        "attendance": attendance,
    }


def _parse_ids(ids_str: str) -> list[str]:
    """Parse a comma-separated string of IDs."""
    if not ids_str:
        return []
    return [s.strip() for s in ids_str.split(",") if s.strip()]





def _attendance_stats(records: list[dict]) -> dict[str, Any]:
    """Compute attendance statistics from a list of attendance records."""
    total = len(records)
    present = sum(1 for r in records if r.get("status") == "present")
    late = sum(1 for r in records if r.get("status") == "late")
    absent = sum(1 for r in records if r.get("status") == "absent")
    marked = total  # all records are marked

    attendance_rate = round((present / total) * 100, 1) if total > 0 else 0.0

    # Last visit: most recent date with a present or late status
    dated = sorted(
        [r for r in records if r.get("date") and r.get("status") in ("present", "late")],
        key=lambda r: r["date"],
        reverse=True,
    )
    last_visit = dated[0]["date"] if dated else ""

    # History sorted by date descending
    history = sorted(records, key=lambda r: r.get("date", ""), reverse=True)

    # Count unique course days as "total lessons available"
    unique_dates = set(r.get("date", "") for r in records)
    total_lessons = len(unique_dates)

    return {
        "total_records": total,
        "total_lessons": total_lessons,
        "present": present,
        "late": late,
        "absent": absent,
        "marked": marked,
        "unmarked": 0,
        "attendance_rate": attendance_rate,
        "last_visit": last_visit,
        "history": history,
    }
