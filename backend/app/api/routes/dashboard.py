"""Dashboard API route — aggregated data for the main page."""

import logging
from fastapi import APIRouter

from backend.app.core.security import CurrentUser
from backend.app.services.dashboard_service import get_dashboard

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
async def api_get_dashboard(current_user: CurrentUser):
    """Get aggregated dashboard data.

    Returns today's courses with attendance stats,
    overall summary, and payment overview.
    """
    logger.info(f"TRACE_DASHBOARD /api/dashboard — telegram_id={current_user.telegram_id}, role={current_user.role.value}")
    dashboard = get_dashboard(telegram_id=current_user.telegram_id, role=current_user.role.value)
    logger.info(f"TRACE_DASHBOARD /api/dashboard — response summary: "
                f"today_lessons={len(dashboard.get('today',{}).get('lessons',[]))}, "
                f"courses={dashboard.get('summary',{}).get('total_courses',0)}, "
                f"students={dashboard.get('summary',{}).get('total_students',0)}")
    return dashboard
