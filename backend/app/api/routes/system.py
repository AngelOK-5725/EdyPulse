"""System API routes — owner-only panel with global statistics."""

import logging

from fastapi import APIRouter

from backend.app.core.security import OwnerOnly, CurrentUser
from backend.app.core.config import settings
from backend.app.services.course_service import list_courses
from backend.app.services.student_service import list_students
from backend.app.services.attendance_service import list_attendance
from backend.app.services.payment_service import list_payments
from backend.app.services.user_service import _get_users_repo

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/stats")
async def api_system_stats(owner: OwnerOnly):
    """Get global system statistics (owner only)."""
    # Owner sees all data (no user_id filter)
    courses = list_courses(telegram_id=owner.telegram_id, role=owner.role.value)
    students = list_students(telegram_id=owner.telegram_id, role=owner.role.value)
    all_attendance = list_attendance(telegram_id=owner.telegram_id, role=owner.role.value)
    payments = list_payments(telegram_id=owner.telegram_id, role=owner.role.value)

    # Users
    users_repo = _get_users_repo()
    all_users = users_repo.get_all() if users_repo else []

    total_users = len(all_users)
    active_7d = sum(1 for u in all_users if u.get("is_active", "true") == "true")

    # Teachers = admin + owner roles
    teachers = sum(1 for u in all_users if u.get("role") in ("admin", "owner"))

    # Total lessons (unique dates across all attendance)
    lesson_dates = set(r.get("date", "") for r in all_attendance if r.get("date"))
    total_lessons = len(lesson_dates)

    # Payment totals
    paid_amount = sum(float(p.get("amount", 0)) for p in payments)

    # Recent users (last 10 registrations)
    recent_users = sorted(
        [u for u in all_users if u.get("created_at")],
        key=lambda u: u.get("created_at", ""),
        reverse=True,
    )[:10]

    return {
        "users_total": total_users,
        "users_active_7d": active_7d,
        "courses_total": len(courses),
        "students_total": len(students),
        "teachers_total": teachers,
        "lessons_total": total_lessons,
        "paid_amount": paid_amount,
        "google_sheets": bool(settings.GOOGLE_SHEETS_SPREADSHEET_ID),
        "api_status": "online",
        "backend_status": "online",
        "recent_users": [
            {
                "first_name": u.get("first_name", ""),
                "last_name": u.get("last_name", ""),
                "role": u.get("role", "user"),
                "created_at": u.get("created_at", ""),
            }
            for u in recent_users
        ],
    }
