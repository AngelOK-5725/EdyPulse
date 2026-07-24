"""Groups API routes — Course → Group → Lesson architecture.

A Group sits between a Course and its Lessons:
  - Belongs to a Course
  - Has a stable roster of students (student_ids)
  - Has its own schedule (days, start_time, end_time)
  - Has its own location and teacher
  - Lessons are generated FROM the group (inheriting time, location, students)
"""

import logging
from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel
from typing import Optional

from backend.app.core.security import CurrentUser, AdminOnly
from backend.app.services.group_service import (
    list_groups, get_group, create_group, update_group, delete_group,
    add_student_to_group, remove_student_from_group,
)
from backend.app.services.student_service import list_students
from backend.app.services.course_service import get_course

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/groups", tags=["groups"])


class GroupCreate(BaseModel):
    course_id: str
    name: str
    days: list[str] = []
    start_time: str = ""
    end_time: str = ""
    location: str = ""
    location_link: str = ""
    teacher: str = ""
    student_ids: list[str] = []


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    days: Optional[list[str]] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    location_link: Optional[str] = None
    teacher: Optional[str] = None
    student_ids: Optional[list[str]] = None
    is_active: Optional[bool] = None


class AddStudentRequest(BaseModel):
    student_id: str


@router.get("")
async def api_list_groups(
    current_user: CurrentUser,
    course_id: Optional[str] = Query(None),
):
    """Get groups, optionally filtered by course."""
    groups = list_groups(
        course_id=course_id,
        active_only=True,
        telegram_id=current_user.telegram_id,
        role=current_user.role.value,
    )

    # Enrich with student count
    enriched = []
    for g in groups:
        student_ids_str = g.get("student_ids", "")
        student_ids = [s.strip() for s in student_ids_str.split(",") if s.strip()] if student_ids_str else []
        g["student_count"] = len(student_ids)
        enriched.append(g)

    return {"groups": enriched}


@router.get("/{group_id}")
async def api_get_group(group_id: str, current_user: CurrentUser):
    """Get a group by ID with enriched data."""
    group = get_group(
        group_id,
        telegram_id=current_user.telegram_id,
        role=current_user.role.value,
    )
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    # Enrich with course title
    course_id = group.get("course_id", "")
    course = get_course(course_id) if course_id else None
    group["course_title"] = course.get("title", "") if course else ""

    # Enrich student list
    student_ids_str = group.get("student_ids", "")
    student_ids = [s.strip() for s in student_ids_str.split(",") if s.strip()] if student_ids_str else []
    group["student_count"] = len(student_ids)

    # Get student details
    all_students = list_students(
        telegram_id=current_user.telegram_id,
        role=current_user.role.value,
    )
    group_students = [s for s in all_students if s.get("id") in student_ids and s.get("is_active", "true") == "true"]
    group["students"] = group_students

    return group


@router.post("", status_code=status.HTTP_201_CREATED)
async def api_create_group(body: GroupCreate, current_user: CurrentUser):
    """Create a new group."""
    import uuid
    data = body.model_dump()
    data["id"] = f"grp_{uuid.uuid4().hex[:8]}"
    result = create_group(data, telegram_id=current_user.telegram_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create group")
    return result


@router.put("/{group_id}")
async def api_update_group(group_id: str, body: GroupUpdate, current_user: CurrentUser):
    """Update a group."""
    data = {k: v for k, v in body.model_dump().items() if v is not None}

    # Convert lists to comma-separated strings for storage
    if "days" in data and isinstance(data["days"], list):
        data["days"] = ",".join(data["days"])
    if "student_ids" in data and isinstance(data["student_ids"], list):
        data["student_ids"] = ",".join(data["student_ids"])

    # Convert is_active to string
    if "is_active" in data:
        data["is_active"] = "true" if data["is_active"] else "false"

    success = update_group(
        group_id, data,
        telegram_id=current_user.telegram_id,
        role=current_user.role.value,
    )
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    return {"status": "ok"}


@router.delete("/{group_id}")
async def api_delete_group(group_id: str, current_user: CurrentUser):
    """Soft-delete (archive) a group."""
    success = delete_group(
        group_id,
        telegram_id=current_user.telegram_id,
        role=current_user.role.value,
    )
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    return {"status": "ok"}


@router.post("/{group_id}/students")
async def api_add_student_to_group(group_id: str, body: AddStudentRequest, current_user: CurrentUser):
    """Add a student to the group's stable roster."""
    success = add_student_to_group(
        group_id, body.student_id,
        telegram_id=current_user.telegram_id,
        role=current_user.role.value,
    )
    if not success:
        group = get_group(
            group_id,
            telegram_id=current_user.telegram_id,
            role=current_user.role.value,
        )
        if group:
            student_ids_str = group.get("student_ids", "")
            existing_ids = [s.strip() for s in student_ids_str.split(",") if s.strip()] if student_ids_str else []
            if body.student_id in existing_ids:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Student is already in this group",
                )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group or student not found",
        )
    return {"status": "ok"}


@router.delete("/{group_id}/students/{student_id}")
async def api_remove_student_from_group(group_id: str, student_id: str, current_user: CurrentUser):
    """Remove a student from the group's stable roster."""
    success = remove_student_from_group(
        group_id, student_id,
        telegram_id=current_user.telegram_id,
        role=current_user.role.value,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group or student not found in group",
        )
    return {"status": "ok"}


@router.post("/clear-students")
async def api_clear_group_students(current_user: CurrentUser):
    """Очистить student_ids во всех группах.

    Полезно после миграции, когда group.student_ids унаследовали
    старые данные из course.student_ids.

    Требует прав администратора.
    """
    groups = list_groups(
        active_only=True,
        telegram_id=current_user.telegram_id,
        role=current_user.role.value,
    )

    cleared = 0
    errors = 0
    details = []

    for g in groups:
        gid = g.get("id", "")
        name = g.get("name", "")
        ids_str = g.get("student_ids", "")
        student_ids = [s.strip() for s in ids_str.split(",") if s.strip()] if ids_str else []

        if not student_ids:
            details.append({"id": gid, "name": name, "cleared": False, "reason": "already empty"})
            continue

        success = update_group(
            gid, {"student_ids": ""},
            telegram_id=current_user.telegram_id,
            role=current_user.role.value,
        )
        if success:
            cleared += 1
            details.append({"id": gid, "name": name, "cleared": True, "removed": len(student_ids)})
        else:
            errors += 1
            details.append({"id": gid, "name": name, "cleared": False, "reason": "update failed"})

    return {
        "status": "ok",
        "total_groups": len(groups),
        "cleared": cleared,
        "errors": errors,
        "details": details,
    }
