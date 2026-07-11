"""Payment service — simple payment journal. No balance calculations."""

import logging
from datetime import datetime, date, timezone
from typing import Any, Optional

from backend.app.core.config import settings
from backend.app.services.user_service import get_internal_user_id, is_admin_role

logger = logging.getLogger(__name__)

_memory_store: Optional[Any] = None


def _get_repo():
    spreadsheet_id = settings.GOOGLE_SHEETS_SPREADSHEET_ID
    if not spreadsheet_id:
        return _get_memory_store()
    try:
        from sheets.repositories.payments import PaymentsRepository
        return PaymentsRepository(spreadsheet_id=spreadsheet_id)
    except ImportError:
        return _get_memory_store()


def _get_memory_store():
    global _memory_store
    if _memory_store is None:
        from sheets.repositories.memory import InMemoryRepository
        from sheets.repositories.payments import PAYMENTS_HEADERS
        _memory_store = InMemoryRepository(PAYMENTS_HEADERS)
    return _memory_store


def _user_filter(records: list[dict], user_id: Optional[str]) -> list[dict]:
    if not user_id:
        return records
    return [r for r in records if r.get("user_id", "") in ("", user_id)]


def list_payments(telegram_id: Optional[int] = None, role: Optional[str] = None) -> list[dict]:
    """Get all payment records, filtered by user_id for non-Admin+ users."""
    repo = _get_repo()
    try:
        records = repo.get_all()
        if not is_admin_role(role or "") and telegram_id is not None:
            user_id = get_internal_user_id(telegram_id)
            records = _user_filter(records, user_id)
        records.sort(key=lambda p: p.get("payment_date", ""), reverse=True)
        return records
    except Exception as e:
        logger.error(f"Failed to list payments: {e}")
        return []


def get_student_payments(student_id: str, telegram_id: Optional[int] = None, role: Optional[str] = None) -> list[dict]:
    """Get all payments for a student. Filtered by user_id for non-Admin+ users."""
    repo = _get_repo()
    try:
        records = repo.find(student_id=student_id)
        if not is_admin_role(role or "") and telegram_id is not None:
            user_id = get_internal_user_id(telegram_id)
            records = _user_filter(records, user_id)
        records.sort(key=lambda p: p.get("payment_date", ""), reverse=True)
        return records
    except Exception as e:
        logger.error(f"Failed to get payments for student {student_id}: {e}")
        return []


def create_payment(data: dict, telegram_id: Optional[int] = None) -> Optional[dict]:
    """Create a payment record in the journal.

    If telegram_id is provided, resolves the internal user_id
    and records it as the owner of this payment record.
    """
    repo = _get_repo()
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "id": data.get("id", ""),
        "student_id": data.get("student_id", ""),
        "course_id": data.get("course_id", ""),
        "amount": str(data.get("amount", 0)),
        "payment_date": data.get("payment_date", date.today().isoformat()),
        "payment_type": data.get("payment_type", "partial"),
        "comment": data.get("comment", ""),
        "created_at": now,
    }
    # Record the owner if we have a telegram_id
    if telegram_id is not None:
        owner_id = get_internal_user_id(telegram_id)
        if owner_id:
            record["user_id"] = owner_id
    try:
        return repo.create(record)
    except Exception as e:
        logger.error(f"Failed to create payment: {e}")
        return None


def update_payment(payment_id: str, data: dict, telegram_id: Optional[int] = None, role: Optional[str] = None) -> bool:
    """Update a payment record. Checks ownership and never allows changing the owner (user_id)."""
    data.pop("user_id", None)
    repo = _get_repo()
    try:
        existing = repo.get_by_id(payment_id)
        if not existing:
            return False
        if not is_admin_role(role or "") and telegram_id is not None:
            user_id = get_internal_user_id(telegram_id)
            if not user_id or existing.get("user_id", "") not in ("", user_id):
                return False
        return repo.update(payment_id, data)
    except Exception as e:
        logger.error(f"Failed to update payment {payment_id}: {e}")
        return False
