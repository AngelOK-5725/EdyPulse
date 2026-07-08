"""Attendance API routes."""

import logging
from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel
from typing import Optional

from backend.app.core.security import CurrentUser
from backend.app.services.attendance_service import (
    list_attendance, get_student_attendance, mark_attendance, update_attendance,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/attendance", tags=["attendance"])


@router.get("/today")
async def api_today_attendance(current_user: CurrentUser):
    """Get all attendance records for today."""
    from datetime import date
    today_str = date.today().isoformat()
    records = list_attendance(date=today_str)
    return {"attendance": records,"date": today_str}


class AttendanceMark(BaseModel):
    lesson_id: str = ""
    date: str
    course_id: str
    student_id: str
    status: str = "present"
    comment: str = ""


class AttendanceUpdate(BaseModel):
    status: Optional[str] = None
    comment: Optional[str] = None


@router.get("")
async def api_list_attendance(
    current_user: CurrentUser,
    course_id: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
):
    """Get attendance records, optionally filtered by course and/or date."""
    records = list_attendance(course_id, date)
    return {"attendance": records}


@router.get("/student/{student_id}")
async def api_student_attendance(student_id: str, current_user: CurrentUser):
    """Get all attendance records for a specific student."""
    records = get_student_attendance(student_id)
    return {"attendance": records}


@router.post("", status_code=status.HTTP_201_CREATED)
async def api_mark_attendance(body: AttendanceMark, current_user: CurrentUser):
    """Mark attendance for a student."""
    data = body.model_dump()
    data["marked_by"] = current_user.telegram_id
    result = mark_attendance(data)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark attendance",
        )
    return result


@router.put("/{attendance_id}")
async def api_update_attendance(attendance_id: str, body: AttendanceUpdate, current_user: CurrentUser):
    """Update an attendance record."""
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    success = update_attendance(attendance_id, data)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance not found")
    return {"status": "ok"}
