"""Courses API routes."""

import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from backend.app.core.security import CurrentUser, AdminOnly
from backend.app.services.course_service import (
    list_courses, get_course, create_course, update_course, delete_course,
    enroll_student, unenroll_student,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/courses", tags=["courses"])


class CourseCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    days: str = ""
    time: Optional[str] = ""
    duration: Optional[int] = None   # minutes, e.g. 60 or 90
    price: float = 0
    teacher_id: Optional[int] = None
    color: str = "#6C5CE7"
    student_ids: str = ""
    location: Optional[str] = ""
    location_link: Optional[str] = ""
    # Tariff fields
    monthly_price: Optional[float] = None
    lesson_price: Optional[float] = None
    lessons_per_week: Optional[int] = None
    payment_type: str = "monthly"


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    days: Optional[str] = None
    time: Optional[str] = None
    duration: Optional[int] = None   # minutes
    price: Optional[float] = None
    color: Optional[str] = None
    student_ids: Optional[str] = None
    location: Optional[str] = None
    location_link: Optional[str] = None
    # Tariff fields
    monthly_price: Optional[float] = None
    lesson_price: Optional[float] = None
    lessons_per_week: Optional[int] = None
    payment_type: Optional[str] = None


@router.get("")
async def api_list_courses(current_user: CurrentUser):
    """Get all active courses."""
    courses = list_courses(telegram_id=current_user.telegram_id, role=current_user.role.value)
    return {"courses": courses}


@router.get("/{course_id}")
async def api_get_course(course_id: str, current_user: CurrentUser):
    """Get a course by ID."""
    course = get_course(course_id, telegram_id=current_user.telegram_id, role=current_user.role.value)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course


@router.post("", status_code=status.HTTP_201_CREATED)
async def api_create_course(body: CourseCreate, current_user: CurrentUser):
    """Create a new course."""
    data = body.model_dump()
    data["teacher_id"] = current_user.telegram_id
    result = create_course(data, telegram_id=current_user.telegram_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create course")
    return result


@router.put("/{course_id}")
async def api_update_course(course_id: str, body: CourseUpdate, current_user: CurrentUser):
    """Update a course."""
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    success = update_course(course_id, data, telegram_id=current_user.telegram_id, role=current_user.role.value)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return {"status": "ok"}


@router.delete("/{course_id}")
async def api_delete_course(course_id: str, admin: AdminOnly):
    """Soft-delete a course (Admin, Owner)."""
    success = delete_course(course_id, telegram_id=admin.telegram_id, role=admin.role.value)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return {"status": "ok"}


class EnrollRequest(BaseModel):
    student_id: str


@router.post("/{course_id}/enroll")
async def api_enroll_student(course_id: str, body: EnrollRequest, current_user: CurrentUser):
    """Enroll an existing student in this course."""
    success = enroll_student(course_id, body.student_id, telegram_id=current_user.telegram_id, role=current_user.role.value)
    if not success:
        # Service returns False for: course/student not found, or already enrolled.
        # Check if the student is actually already in the course.
        course = get_course(course_id, telegram_id=current_user.telegram_id, role=current_user.role.value)
        if course:
            enrolled_ids = [x.strip() for x in course.get("student_ids", "").split(",") if x.strip()]
            if body.student_id in enrolled_ids:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Student is already enrolled in this course",
                )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course or student not found",
        )
    return {"status": "ok"}


@router.delete("/{course_id}/enroll/{student_id}")
async def api_unenroll_student(course_id: str, student_id: str, current_user: CurrentUser):
    """Unenroll a student from this course."""
    success = unenroll_student(course_id, student_id, telegram_id=current_user.telegram_id, role=current_user.role.value)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course or student not found",
        )
    return {"status": "ok"}
