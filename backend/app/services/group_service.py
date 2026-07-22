"""Group service — CRUD operations with Google Sheets or in-memory fallback.

Group is an intermediate entity between Course and Lesson.
A group has a stable roster of students (student_ids), a recurring schedule
(days, start_time, end_time), and a location/teacher.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from backend.app.core.config import settings
from backend.app.services.user_service import get_internal_user_id, is_owner_role
from sheets.repositories.headers import GROUPS_HEADERS

logger = logging.getLogger(__name__)

_memory_store: Optional[Any] = None


def _get_repo():
    spreadsheet_id = settings.GOOGLE_SHEETS_SPREADSHEET_ID
    if not spreadsheet_id:
        return _get_memory_store()
    try:
        from sheets.repositories.groups import GroupsRepository
        return GroupsRepository(spreadsheet_id=spreadsheet_id)
    except ImportError:
        return _get_memory_store()


def _get_memory_store():
    global _memory_store
    if _memory_store is None:
        from sheets.repositories.memory import InMemoryRepository
        _memory_store = InMemoryRepository(GROUPS_HEADERS)
    return _memory_store


def _parse_ids(ids_str: str) -> list[str]:
    """Parse a comma-separated string into a list, filtering empties."""
    return [x.strip() for x in ids_str.split(",") if x.strip()]


def _user_filter(records: list[dict], user_id: Optional[str]) -> list[dict]:
    """Filter records to only those accessible by a user: owned or legacy (user_id="")."""
    if not user_id:
        return records
    return [r for r in records if r.get("user_id", "") in ("", user_id)]


def list_groups(
    course_id: Optional[str] = None,
    active_only: bool = True,
    telegram_id: Optional[int] = None,
    role: Optional[str] = None,
) -> list[dict]:
    """Get groups, optionally filtered by course. Filtered by user_id for non-Owner users."""
    repo = _get_repo()
    try:
        groups = repo.get_all()
        if not is_owner_role(role or "") and telegram_id is not None:
            user_id = get_internal_user_id(telegram_id)
            groups = _user_filter(groups, user_id)

        if active_only:
            groups = [g for g in groups if g.get("is_active", "true") == "true"]

        if course_id:
            groups = [g for g in groups if g.get("course_id", "") == course_id]

        return groups
    except Exception as e:
        logger.error(f"Failed to list groups: {e}")
        return []


def get_group(
    group_id: str,
    telegram_id: Optional[int] = None,
    role: Optional[str] = None,
) -> Optional[dict]:
    """Get a group by ID. Non-Owner users can only access their own or legacy records."""
    repo = _get_repo()
    try:
        group = repo.get_by_id(group_id)
        if not group:
            return None
        if is_owner_role(role or ""):
            return group
        if telegram_id is not None:
            user_id = get_internal_user_id(telegram_id)
            if not user_id:
                return group
            if user_id and group.get("user_id", "") in ("", user_id):
                return group
            return None
        return group
    except Exception as e:
        logger.error(f"Failed to get group {group_id}: {e}")
        return None


def create_group(data: dict, telegram_id: Optional[int] = None) -> Optional[dict]:
    """Create a new group.

    If telegram_id is provided, resolves the internal user_id
    and records it as the owner of this group record.
    """
    repo = _get_repo()
    now = datetime.now(timezone.utc).isoformat()

    # Normalize days list to comma-separated string
    days_raw = data.get("days", [])
    if isinstance(days_raw, list):
        days_str = ",".join(days_raw)
    else:
        days_str = str(days_raw)

    # Normalize student_ids
    student_ids_raw = data.get("student_ids", [])
    if isinstance(student_ids_raw, list):
        student_ids_str = ",".join(student_ids_raw)
    else:
        student_ids_str = str(student_ids_raw)

    record = {
        "id": data.get("id", ""),
        "course_id": data.get("course_id", ""),
        "name": data.get("name", ""),
        "days": days_str,
        "start_time": data.get("start_time", ""),
        "end_time": data.get("end_time", ""),
        "location": data.get("location", ""),
        "location_link": data.get("location_link", ""),
        "teacher": data.get("teacher", ""),
        "student_ids": student_ids_str,
        "is_active": "true",
        "created_at": now,
    }
    if telegram_id is not None:
        owner_id = get_internal_user_id(telegram_id)
        if owner_id:
            record["user_id"] = owner_id
    try:
        return repo.create(record)
    except Exception as e:
        logger.error(f"Failed to create group: {e}")
        return None


def update_group(
    group_id: str,
    data: dict,
    telegram_id: Optional[int] = None,
    role: Optional[str] = None,
) -> bool:
    """Update a group. Checks ownership and never allows changing the owner (user_id)."""
    data.pop("user_id", None)
    existing = get_group(group_id, telegram_id, role)
    if not existing:
        return False
    repo = _get_repo()
    try:
        return repo.update(group_id, data)
    except Exception as e:
        logger.error(f"Failed to update group {group_id}: {e}")
        return False


def delete_group(
    group_id: str,
    telegram_id: Optional[int] = None,
    role: Optional[str] = None,
) -> bool:
    """Soft-delete a group. Checks ownership first."""
    existing = get_group(group_id, telegram_id, role)
    if not existing:
        return False
    repo = _get_repo()
    try:
        return repo.delete(group_id)
    except Exception as e:
        logger.error(f"Failed to delete group {group_id}: {e}")
        return False


def add_student_to_group(
    group_id: str,
    student_id: str,
    telegram_id: Optional[int] = None,
    role: Optional[str] = None,
) -> bool:
    """Add a student to the group's roster. Updates group.student_ids."""
    group = get_group(group_id, telegram_id, role)
    if not group:
        return False

    current_ids = _parse_ids(group.get("student_ids", ""))
    if student_id in current_ids:
        logger.warning(f"Student {student_id} already in group {group_id}")
        return False

    current_ids.append(student_id)
    return update_group(
        group_id,
        {"student_ids": ",".join(current_ids)},
        telegram_id,
        role,
    )


def remove_student_from_group(
    group_id: str,
    student_id: str,
    telegram_id: Optional[int] = None,
    role: Optional[str] = None,
) -> bool:
    """Remove a student from the group's roster. Updates group.student_ids."""
    group = get_group(group_id, telegram_id, role)
    if not group:
        return False

    current_ids = _parse_ids(group.get("student_ids", ""))
    if student_id not in current_ids:
        logger.warning(f"Student {student_id} not in group {group_id}")
        return False

    current_ids.remove(student_id)
    return update_group(
        group_id,
        {"student_ids": ",".join(current_ids)},
        telegram_id,
        role,
    )


def get_groups_by_course(
    course_id: str,
    active_only: bool = True,
    telegram_id: Optional[int] = None,
    role: Optional[str] = None,
) -> list[dict]:
    """Get all groups belonging to a course."""
    return list_groups(
        course_id=course_id,
        active_only=active_only,
        telegram_id=telegram_id,
        role=role,
    )
