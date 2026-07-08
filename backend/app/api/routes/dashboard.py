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
    dashboard = get_dashboard()
    return dashboard
