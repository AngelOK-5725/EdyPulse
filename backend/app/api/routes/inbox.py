"""Inbox API route — the teacher's daily action stream."""

import logging
from fastapi import APIRouter

from backend.app.core.security import CurrentUser
from backend.app.services.inbox_service import get_inbox

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/inbox", tags=["inbox"])


@router.get("")
async def api_get_inbox(current_user: CurrentUser):
    """Get the inbox — a prioritised stream of what needs attention today.

    Returns actionable items grouped by priority:
      - 🔴 High: lessons needing marking, overdue payments
      - 🟡 Medium: trial students, long-absent students
      - 🟢 Low: completed lessons, upcoming actions
    """
    inbox = get_inbox()
    return inbox
