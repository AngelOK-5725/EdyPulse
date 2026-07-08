"""Payment service — simple payment journal. No balance calculations."""

import logging
from datetime import datetime, date, timezone
from typing import Any, Optional

from backend.app.core.config import settings

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


def list_payments() -> list[dict]:
    """Get all payment records (sorted by date descending)."""
    repo = _get_repo()
    try:
        records = repo.get_all()
        records.sort(key=lambda p: p.get("payment_date", ""), reverse=True)
        return records
    except Exception as e:
        logger.error(f"Failed to list payments: {e}")
        return []


def get_student_payments(student_id: str) -> list[dict]:
    """Get all payments for a student (sorted by date descending)."""
    repo = _get_repo()
    try:
        records = repo.find(student_id=student_id)
        records.sort(key=lambda p: p.get("payment_date", ""), reverse=True)
        return records
    except Exception as e:
        logger.error(f"Failed to get payments for student {student_id}: {e}")
        return []


def create_payment(data: dict) -> Optional[dict]:
    """Create a payment record in the journal."""
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
    try:
        return repo.create(record)
    except Exception as e:
        logger.error(f"Failed to create payment: {e}")
        return None


def update_payment(payment_id: str, data: dict) -> bool:
    """Update a payment record."""
    repo = _get_repo()
    try:
        return repo.update(payment_id, data)
    except Exception as e:
        logger.error(f"Failed to update payment {payment_id}: {e}")
        return False
