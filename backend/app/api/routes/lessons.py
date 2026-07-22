"""Lessons API routes — the core of lesson-centric architecture."""

import logging
from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel
from typing import Optional

from backend.app.core.security import CurrentUser, AdminOnly
from backend.app.services.lesson_service import (
    list_lessons, get_lesson, create_lesson, update_lesson, delete_lesson,
    ensure_lesson_for_course, enrich_lesson_with_attendance,
)
from backend.app.services.course_service import get_course
from backend.app.services.student_service import list_students
from backend.app.services.attendance_service import list_attendance

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/lessons", tags=["lessons"])


class LessonCreate(BaseModel):
    course_id: str = ""
    date: str
    time: str = ""
    title: str = ""
    status: str = "scheduled"
    location: str = ""
    location_link: str = ""
    lesson_type: str = "regular"


class LessonUpdate(BaseModel):
    time: Optional[str] = None
    title: Optional[str] = None
    status: Optional[str] = None
    homework: Optional[str] = None
    location: Optional[str] = None
    location_link: Optional[str] = None
    note: Optional[str] = None
    rescheduled_to: Optional[str] = None
    lesson_type: Optional[str] = None


@router.get("")
async def api_list_lessons(
    current_user: CurrentUser,
    date: Optional[str] = Query(None),
    course_id: Optional[str] = Query(None),
):
    """Get lessons, optionally filtered by date and/or course."""
    lessons = list_lessons(date, course_id, telegram_id=current_user.telegram_id, role=current_user.role.value)
    # Enrich with attendance data
    all_students = list_students(telegram_id=current_user.telegram_id, role=current_user.role.value)
    all_attendance = list_attendance(date=date, telegram_id=current_user.telegram_id, role=current_user.role.value)
    enriched = [enrich_lesson_with_attendance(l, all_students, all_attendance) for l in lessons]
    return {"lessons": enriched}


@router.get("/today")
async def api_today_lessons(current_user: CurrentUser):
    """Get today's lessons (auto-created if needed)."""
    from backend.app.services.course_service import list_courses
    from backend.app.services.lesson_service import ensure_today_lessons

    courses = list_courses(telegram_id=current_user.telegram_id, role=current_user.role.value)
    lessons = ensure_today_lessons(courses, telegram_id=current_user.telegram_id)
    all_students = list_students(telegram_id=current_user.telegram_id, role=current_user.role.value)
    from datetime import date
    all_attendance = list_attendance(date=date.today().isoformat(), telegram_id=current_user.telegram_id, role=current_user.role.value)
    enriched = [enrich_lesson_with_attendance(l, all_students, all_attendance) for l in lessons]
    return {"lessons": enriched}


@router.get("/{lesson_id}")
async def api_get_lesson(lesson_id: str, current_user: CurrentUser):
    """Get a lesson by ID with enriched data."""
    lesson = get_lesson(lesson_id, telegram_id=current_user.telegram_id, role=current_user.role.value)
    if not lesson:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")
    all_students = list_students(telegram_id=current_user.telegram_id, role=current_user.role.value)
    all_attendance = list_attendance(date=lesson.get("date", ""), telegram_id=current_user.telegram_id, role=current_user.role.value)
    enriched = enrich_lesson_with_attendance(lesson, all_students, all_attendance)
    return enriched


@router.post("/ensure")
async def api_ensure_lesson(body: LessonCreate, current_user: CurrentUser):
    """Auto-create or get existing lesson for a course+date."""
    if body.course_id:
        course = get_course(body.course_id, telegram_id=current_user.telegram_id, role=current_user.role.value)
        if not course:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
        lesson = ensure_lesson_for_course(course, body.date, telegram_id=current_user.telegram_id)
    else:
        lesson = create_lesson(body.model_dump(), telegram_id=current_user.telegram_id)

    if not lesson:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create lesson")

    all_students = list_students(telegram_id=current_user.telegram_id, role=current_user.role.value)
    all_attendance = list_attendance(date=lesson.get("date", ""), telegram_id=current_user.telegram_id, role=current_user.role.value)
    return enrich_lesson_with_attendance(lesson, all_students, all_attendance)


@router.post("", status_code=status.HTTP_201_CREATED)
async def api_create_lesson(body: LessonCreate, current_user: CurrentUser):
    """Create a one-off lesson manually."""
    result = create_lesson(body.model_dump(), telegram_id=current_user.telegram_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create lesson")
    all_students = list_students(telegram_id=current_user.telegram_id, role=current_user.role.value)
    all_attendance = list_attendance(date=result.get("date", ""), telegram_id=current_user.telegram_id, role=current_user.role.value)
    return enrich_lesson_with_attendance(result, all_students, all_attendance)


@router.put("/{lesson_id}")
async def api_update_lesson(lesson_id: str, body: LessonUpdate, current_user: CurrentUser):
    """Update a lesson (status, homework, etc.)."""
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    success = update_lesson(lesson_id, data, telegram_id=current_user.telegram_id, role=current_user.role.value)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")
    return {"status": "ok"}


@router.delete("/{lesson_id}")
async def api_delete_lesson(lesson_id: str, admin: AdminOnly):
    """Soft-delete a lesson (Admin, Owner)."""
    success = delete_lesson(lesson_id, telegram_id=admin.telegram_id, role=admin.role.value)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")
    return {"status": "ok"}
