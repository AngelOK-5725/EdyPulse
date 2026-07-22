"""EduPulse API — main application."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.routes.auth import router as auth_router
from backend.app.api.routes.courses import router as courses_router
from backend.app.api.routes.students import router as students_router
from backend.app.api.routes.attendance import router as attendance_router
from backend.app.api.routes.payments import router as payments_router
from backend.app.api.routes.achievements import router as achievements_router
from backend.app.api.routes.dashboard import router as dashboard_router
from backend.app.api.routes.system import router as system_router
from backend.app.api.routes.lessons import router as lessons_router
from backend.app.api.routes.inbox import router as inbox_router
from backend.app.api.routes.groups import router as groups_router

from backend.app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend for EduPulse Telegram Mini App",
    version=settings.VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Register Routers ──────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(courses_router)
app.include_router(students_router)
app.include_router(attendance_router)
app.include_router(payments_router)
app.include_router(achievements_router)
app.include_router(dashboard_router)
app.include_router(system_router)
app.include_router(lessons_router)
app.include_router(inbox_router)
app.include_router(groups_router)


# ─── Lifecycle Events ──────────────────────────────────────────────────────


def _seed_demo_data():
    """Seed demo data into in-memory repositories when no Google Sheets configured."""
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()

    # Courses
    from backend.app.services.course_service import _get_memory_store
    course_repo = _get_memory_store()
    course_repo.clear()

    courses_data = [
        {
            "id": "course_1", "title": "Робототехника Junior",
            "description": "Основы робототехники для начинающих",
            "days": "Пн,Ср", "time": "17:00", "price": "40000",
            "teacher_id": "0", "color": "#6C5CE7",
            "student_ids": "student_1,student_2",
            "is_active": "true", "created_at": now,
            "monthly_price": "40000", "lesson_price": "5000",
            "lessons_per_week": "2", "payment_type": "monthly",
        },
        {
            "id": "course_2", "title": "Scratch",
            "description": "Визуальное программирование",
            "days": "Вт,Чт", "time": "18:30", "price": "25000",
            "teacher_id": "0", "color": "#00B894",
            "student_ids": "student_3",
            "is_active": "true", "created_at": now,
            "monthly_price": "25000", "lesson_price": "3500",
            "lessons_per_week": "2", "payment_type": "monthly",
        },
        {
            "id": "course_3", "title": "Python",
            "description": "Программирование на Python",
            "days": "Пн,Ср,Пт", "time": "19:00", "price": "8000",
            "teacher_id": "0", "color": "#FD79A8",
            "student_ids": "student_1,student_3",
            "is_active": "true", "created_at": now,
            "monthly_price": "35000", "lesson_price": "8000",
            "lessons_per_week": "3", "payment_type": "monthly",
        },
    ]
    for c in courses_data:
        course_repo.create(c)
    logger.info(f"Seeded {len(courses_data)} demo courses")

    # Groups
    from backend.app.services.group_service import _get_memory_store as get_group_store
    group_repo = get_group_store()
    group_repo.clear()

    groups_data = [
        {
            "id": "grp_1", "course_id": "course_1",
            "name": "Робототехника Junior A",
            "days": "Пн,Ср", "start_time": "17:00", "end_time": "18:30",
            "location": "ул. Московская, д. 10", "location_link": "",
            "teacher": "Иванова М. С.",
            "student_ids": "student_1,student_2",
            "is_active": "true", "created_at": now,
        },
        {
            "id": "grp_2", "course_id": "course_1",
            "name": "Робототехника Junior B",
            "days": "Вт,Чт", "start_time": "17:00", "end_time": "18:30",
            "location": "ул. Московская, д. 10", "location_link": "",
            "teacher": "Иванова М. С.",
            "student_ids": "student_1",
            "is_active": "true", "created_at": now,
        },
        {
            "id": "grp_3", "course_id": "course_2",
            "name": "Scratch",
            "days": "Вт,Чт", "start_time": "18:30", "end_time": "20:00",
            "location": "ул. Московская, д. 10", "location_link": "",
            "teacher": "Петров А. В.",
            "student_ids": "student_3,student_4",
            "is_active": "true", "created_at": now,
        },
        {
            "id": "grp_4", "course_id": "course_3",
            "name": "Python",
            "days": "Пн,Ср,Пт", "start_time": "19:00", "end_time": "20:30",
            "location": "ул. Московская, д. 10", "location_link": "",
            "teacher": "Смирнова Е. В.",
            "student_ids": "student_1,student_3",
            "is_active": "true", "created_at": now,
        },
    ]
    for g in groups_data:
        group_repo.create(g)
    logger.info(f"Seeded {len(groups_data)} demo groups")

    # Students
    from backend.app.services.student_service import _get_memory_store
    student_repo = _get_memory_store()
    student_repo.clear()

    students_data = [
        {
            "id": "student_1", "first_name": "Иван", "last_name": "Петров",
            "age": "10", "birth_date": "2015-03-15",
            "parent_contact": "+7 999 111-11-11", "parent_name": "Ольга Петрова", "parent_relation": "Мама",
            "phone": "", "telegram": "@ivan_p",
            "course_ids": "course_1,course_3", "start_date": "2025-01-15",
            "photo_url": "", "is_active": "true", "created_at": now,
        },
        {
            "id": "student_2", "first_name": "Анна", "last_name": "Смирнова",
            "age": "9", "birth_date": "2016-07-22",
            "parent_contact": "+7 999 222-22-22", "parent_name": "Ирина Смирнова", "parent_relation": "Мама",
            "phone": "", "telegram": "@anna_s",
            "course_ids": "course_1", "start_date": "2025-01-15",
            "photo_url": "", "is_active": "true", "created_at": now,
        },
        {
            "id": "student_3", "first_name": "Михаил", "last_name": "Кузнецов",
            "age": "11", "birth_date": "2014-01-10",
            "parent_contact": "+7 999 333-33-33", "parent_name": "Сергей Кузнецов", "parent_relation": "Папа",
            "phone": "", "telegram": "@misha_k",
            "course_ids": "course_2,course_3", "start_date": "2025-01-20",
            "photo_url": "", "is_active": "true", "created_at": now,
        },
        {
            "id": "student_4", "first_name": "Екатерина", "last_name": "Волкова",
            "age": "12", "birth_date": "2013-05-18",
            "parent_contact": "+7 999 444-44-44", "parent_name": "Наталья Волкова", "parent_relation": "Бабушка",
            "phone": "", "telegram": "@katya_v",
            "course_ids": "course_2", "start_date": "2025-02-01",
            "photo_url": "", "is_active": "true", "created_at": now,
        },
    ]
    for s in students_data:
        student_repo.create(s)
    logger.info(f"Seeded {len(students_data)} demo students")

    # Some attendance records for today
    from backend.app.services.attendance_service import _get_memory_store as get_att_store
    att_repo = get_att_store()
    att_repo.clear()

    today = now.split("T")[0]
    attendance_sample = [
        {
            "id": "att_1", "date": today, "course_id": "course_1",
            "student_id": "student_1", "status": "present",
            "comment": "", "marked_by": "0", "created_at": now,
        },
        {
            "id": "att_2", "date": today, "course_id": "course_1",
            "student_id": "student_2", "status": "absent",
            "comment": "Болеет", "marked_by": "0", "created_at": now,
        },
        {
            "id": "att_3", "date": today, "course_id": "course_3",
            "student_id": "student_1", "status": "present",
            "comment": "", "marked_by": "0", "created_at": now,
        },
    ]
    for a in attendance_sample:
        att_repo.create(a)
    logger.info(f"Seeded {len(attendance_sample)} demo attendance records")

    # Sample payments — journal-based format
    from backend.app.services.payment_service import _get_memory_store as get_pay_store
    pay_repo = get_pay_store()

    payments_data = [
        {
            "id": "pay_1", "student_id": "student_1", "course_id": "course_1",
            "amount": "40000", "payment_date": "2026-06-01",
            "payment_type": "monthly",
            "comment": "Оплата за июнь", "created_at": now,
        },
        {
            "id": "pay_2", "student_id": "student_1", "course_id": "course_1",
            "amount": "20000", "payment_date": "2026-07-01",
            "payment_type": "partial",
            "comment": "Частичная оплата за июль", "created_at": now,
        },
        {
            "id": "pay_3", "student_id": "student_2", "course_id": "course_1",
            "amount": "40000", "payment_date": "2026-07-05",
            "payment_type": "monthly",
            "comment": "Оплата за июль", "created_at": now,
        },
        {
            "id": "pay_4", "student_id": "student_3", "course_id": "course_2",
            "amount": "25000", "payment_date": "2026-06-10",
            "payment_type": "monthly",
            "comment": "", "created_at": now,
        },
    ]
    for p in payments_data:
        pay_repo.create(p)
    logger.info(f"Seeded {len(payments_data)} demo payments")

    # Sample achievements
    from backend.app.services.achievement_service import _get_memory_store as get_ach_store
    ach_repo = get_ach_store()

    achievements_data = [
        {
            "id": "ach_1", "student_id": "student_1",
            "title": "Отличник недели", "icon": "🌟",
            "description": "100% посещаемость за неделю",
            "achieved_at": now, "created_at": now,
        },
        {
            "id": "ach_2", "student_id": "student_3",
            "title": "Лучший проект", "icon": "🏆",
            "description": "Лучший проект по Scratch",
            "achieved_at": now, "created_at": now,
        },
    ]
    for a in achievements_data:
        ach_repo.create(a)
    logger.info(f"Seeded {len(achievements_data)} demo achievements")


@app.on_event("startup")
async def startup():
    """Initialize services on startup."""
    spreadsheet_id = settings.GOOGLE_SHEETS_SPREADSHEET_ID
    if spreadsheet_id:
        try:
            from sheets.client import google_sheets_client

            google_sheets_client.initialize(
                credentials_file=settings.GOOGLE_SHEETS_CREDENTIALS_FILE,
                private_key=settings.GOOGLE_SHEETS_PRIVATE_KEY,
                client_email=settings.GOOGLE_SHEETS_CLIENT_EMAIL,
            )
            # Verify by opening the spreadsheet
            google_sheets_client.open_spreadsheet(spreadsheet_id)
            logger.info("Google Sheets client initialised successfully")
        except Exception as e:
            logger.warning(f"Google Sheets init failed (non-fatal): {e}")
            logger.info("Running in memory-only mode — data won't persist")
    else:
        logger.info("Google Sheets not configured — running with seed demo data")
        _seed_demo_data()


# ─── Health Check ──────────────────────────────────────────────────────────


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "version": settings.VERSION,
        "google_sheets": bool(settings.GOOGLE_SHEETS_SPREADSHEET_ID),            "routers": ["auth", "courses", "students", "attendance", "payments", "achievements", "dashboard", "lessons"],
    }
