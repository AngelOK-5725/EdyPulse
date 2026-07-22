"""Lessons API routes — the core of lesson-centric architecture."""

import logging
from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel
from typing import Optional

from backend.app.core.security import CurrentUser, AdminOnly
from backend.app.services.lesson_service import (
    list_lessons, get_lesson, create_lesson, update_lesson, delete_lesson,
    ensure_lesson_for_course, ensure_lesson_for_group, enrich_lesson_with_attendance,
)
from backend.app.services.course_service import get_course
from backend.app.services.group_service import get_group
from backend.app.services.student_service import list_students
from backend.app.services.attendance_service import list_attendance

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/lessons", tags=["lessons"])


class LessonCreate(BaseModel):
    course_id: str = ""
    group_id: str = ""
    date: str
    time: str = ""
    start_time: str = ""
    end_time: str = ""
    title: str = ""
    status: str = "scheduled"
    location: str = ""
    location_link: str = ""
    lesson_type: str = "regular"


class LessonUpdate(BaseModel):
    time: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    date: Optional[str] = None
    title: Optional[str] = None
    status: Optional[str] = None
    homework: Optional[str] = None
    location: Optional[str] = None
    location_link: Optional[str] = None
    note: Optional[str] = None
    rescheduled_to: Optional[str] = None
    lesson_type: Optional[str] = None
    course_id: Optional[str] = None
    group_id: Optional[str] = None


@router.get("")
async def api_list_lessons(
    current_user: CurrentUser,
    date: Optional[str] = Query(None),
    course_id: Optional[str] = Query(None),
    group_id: Optional[str] = Query(None),
):
    """Get lessons, optionally filtered by date, course, and/or group."""
    lessons = list_lessons(date, course_id, group_id, telegram_id=current_user.telegram_id, role=current_user.role.value)
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
    """Auto-create or get existing lesson for a course+date or group+date."""
    lesson = None

    if body.group_id:
        # Ensure lesson from group
        group = get_group(body.group_id, telegram_id=current_user.telegram_id, role=current_user.role.value)
        if not group:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
        lesson = ensure_lesson_for_group(group, body.date, telegram_id=current_user.telegram_id)
    elif body.course_id:
        # Ensure lesson from course (legacy fallback)
        course = get_course(body.course_id, telegram_id=current_user.telegram_id, role=current_user.role.value)
        if not course:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
        lesson = ensure_lesson_for_course(course, body.date, telegram_id=current_user.telegram_id)
    else:
        # Create from raw data
        lesson = create_lesson(body.model_dump(), telegram_id=current_user.telegram_id)

    if not lesson:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create lesson")

    all_students = list_students(telegram_id=current_user.telegram_id, role=current_user.role.value)
    all_attendance = list_attendance(date=lesson.get("date", ""), telegram_id=current_user.telegram_id, role=current_user.role.value)
    return enrich_lesson_with_attendance(lesson, all_students, all_attendance)


def _times_overlap(start1: str, end1: str, start2: str, end2: str) -> bool:
    """Check if two time intervals [start, end) overlap."""
    if not start1 or not start2:
        return False
    if not end1 or not end2:
        return start1 == start2
    return start1 < end2 and end1 > start2


def _find_time_conflict(
    date: str, start_time: str, end_time: str,
    exclude_id: str,
    telegram_id: Optional[int] = None,
    role: Optional[str] = None,
) -> Optional[dict]:
    """Find a non-cancelled lesson on the same date whose time interval
    overlaps with the given [start_time, end_time)."""
    if not date or not start_time:
        return None
    all_lessons = list_lessons(date_str=date, telegram_id=telegram_id, role=role)
    for lesson in all_lessons:
        if lesson.get("status") == "cancelled":
            continue
        if lesson.get("id") == exclude_id:
            continue
        l_start = lesson.get("start_time", "") or lesson.get("time", "")
        l_end = lesson.get("end_time", "")
        if _times_overlap(start_time, end_time, l_start, l_end):
            return lesson
    return None


@router.post("", status_code=status.HTTP_201_CREATED)
async def api_create_lesson(body: LessonCreate, current_user: CurrentUser):
    """Create a one-off lesson manually."""
    # Check for time conflicts
    conflict = _find_time_conflict(
        body.date, body.start_time or body.time, body.end_time,
        exclude_id="",
        telegram_id=current_user.telegram_id,
        role=current_user.role.value,
    )
    if conflict:
        c_title = conflict.get("title", "") or "Занятие"
        c_start = conflict.get("start_time", "") or conflict.get("time", "")
        c_end = conflict.get("end_time", "")
        c_time = f"{c_start}—{c_end}" if c_start and c_end else c_start
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Time conflict with «{c_title}» ({c_time})",
        )

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

    # Check for time conflicts if date or time changed
    lesson = get_lesson(lesson_id, telegram_id=current_user.telegram_id, role=current_user.role.value)
    if lesson:
        new_date = data.get("date", lesson.get("date", ""))
        new_start = data.get("start_time", "") or data.get("time", "") or lesson.get("start_time", "") or lesson.get("time", "")
        new_end = data.get("end_time", "") or lesson.get("end_time", "")
        conflict = _find_time_conflict(
            new_date, new_start, new_end,
            exclude_id=lesson_id,
            telegram_id=current_user.telegram_id,
            role=current_user.role.value,
        )
        if conflict:
            c_title = conflict.get("title", "") or "Занятие"
            c_start = conflict.get("start_time", "") or conflict.get("time", "")
            c_end = conflict.get("end_time", "")
            c_time = f"{c_start}—{c_end}" if c_start and c_end else c_start
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Time conflict with «{c_title}» ({c_time})",
            )

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
