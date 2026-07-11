"""Students API routes."""

import logging
from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel
from typing import Optional

from backend.app.core.security import CurrentUser
from backend.app.services.student_service import (
    list_students, get_student, create_student, update_student, delete_student,
    search_students,
)
from backend.app.services.student_profile_service import get_student_profile

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/students", tags=["students"])


class StudentCreate(BaseModel):
    first_name: str
    last_name: str
    age: Optional[int] = None
    birth_date: Optional[str] = ""
    parent_contact: Optional[str] = ""
    parent_name: Optional[str] = ""
    parent_relation: Optional[str] = ""
    phone: Optional[str] = ""
    telegram: Optional[str] = ""
    course_ids: str | list[str] = ""
    start_date: Optional[str] = ""
    photo_url: Optional[str] = ""


class StudentUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    age: Optional[int] = None
    birth_date: Optional[str] = None
    parent_contact: Optional[str] = None
    parent_name: Optional[str] = None
    parent_relation: Optional[str] = None
    phone: Optional[str] = None
    telegram: Optional[str] = None
    course_ids: Optional[str] = None
    photo_url: Optional[str] = None


@router.get("")
async def api_list_students(
    current_user: CurrentUser,
    course_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    """Get all active students, optionally filtered by course or search query."""
    if search:
        students = search_students(search, telegram_id=current_user.telegram_id, role=current_user.role.value)
    else:
        students = list_students(telegram_id=current_user.telegram_id, role=current_user.role.value, course_id=course_id)
    return {"students": students}


@router.get("/{student_id}")
async def api_get_student(student_id: str, current_user: CurrentUser):
    """Get a student by ID."""
    student = get_student(student_id, telegram_id=current_user.telegram_id, role=current_user.role.value)
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return student


@router.get("/{student_id}/profile")
async def api_student_profile(student_id: str, current_user: CurrentUser):
    """Get full student profile with courses, attendance stats, payments, and achievements."""
    profile = get_student_profile(student_id, telegram_id=current_user.telegram_id, role=current_user.role.value)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return profile


@router.post("", status_code=status.HTTP_201_CREATED)
async def api_create_student(body: StudentCreate, current_user: CurrentUser):
    """Create a new student (Teacher, Admin, Owner)."""
    result = create_student(body.model_dump(), telegram_id=current_user.telegram_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create student")
    return result


@router.put("/{student_id}")
async def api_update_student(student_id: str, body: StudentUpdate, current_user: CurrentUser):
    """Update a student (Teacher, Admin, Owner)."""
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    success = update_student(student_id, data, telegram_id=current_user.telegram_id, role=current_user.role.value)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return {"status": "ok"}


@router.delete("/{student_id}")
async def api_archive_student(student_id: str, current_user: CurrentUser):
    """Soft-delete (archive) a student (Teacher, Admin, Owner).
    Only Owner has the semantic right to permanently delete;
    the frontend hides the destructive button for non-owners."""
    success = delete_student(student_id, telegram_id=current_user.telegram_id, role=current_user.role.value)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return {"status": "ok"}
