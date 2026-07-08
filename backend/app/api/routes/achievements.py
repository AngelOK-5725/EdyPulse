"""Achievements API routes."""

import logging
from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel
from typing import Optional

from backend.app.core.security import CurrentUser, AdminOnly
from backend.app.services.achievement_service import (
    list_achievements, create_achievement, delete_achievement,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/achievements", tags=["achievements"])


class AchievementCreate(BaseModel):
    student_id: str
    title: str
    icon: str = "🏆"
    description: str = ""
    achieved_at: str = ""


@router.get("")
async def api_list_achievements(
    current_user: CurrentUser,
    student_id: Optional[str] = Query(None),
):
    """Get all achievements, optionally filtered by student."""
    achievements = list_achievements(student_id)
    return {"achievements": achievements}


@router.post("", status_code=status.HTTP_201_CREATED)
async def api_create_achievement(body: AchievementCreate, admin: AdminOnly):
    """Create an achievement (admin only)."""
    result = create_achievement(body.model_dump())
    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create achievement",
        )
    return result


@router.delete("/{achievement_id}")
async def api_delete_achievement(achievement_id: str, admin: AdminOnly):
    """Delete an achievement (admin only)."""
    success = delete_achievement(achievement_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Achievement not found")
    return {"status": "ok"}
