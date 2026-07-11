"""Payments API routes — journal-based payment system."""

import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from backend.app.core.security import CurrentUser
from backend.app.services.payment_service import (
    list_payments, get_student_payments, create_payment, update_payment,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/payments", tags=["payments"])


class PaymentCreate(BaseModel):
    student_id: str
    course_id: str
    amount: float
    payment_date: str = ""
    payment_type: str = "partial"
    comment: str = ""


class PaymentUpdate(BaseModel):
    amount: Optional[float] = None
    payment_date: Optional[str] = None
    payment_type: Optional[str] = None
    comment: Optional[str] = None


@router.get("")
async def api_list_payments(current_user: CurrentUser):
    """Get all payment records (sorted by date descending)."""
    payments = list_payments(telegram_id=current_user.telegram_id, role=current_user.role.value)
    return {"payments": payments}


@router.get("/student/{student_id}")
async def api_student_payments(student_id: str, current_user: CurrentUser):
    """Get all payments for a specific student."""
    payments = get_student_payments(student_id, telegram_id=current_user.telegram_id, role=current_user.role.value)
    return {"payments": payments}


@router.post("", status_code=status.HTTP_201_CREATED)
async def api_create_payment(body: PaymentCreate, current_user: CurrentUser):
    """Create a payment record in the journal (Teacher, Admin, Owner)."""
    data = body.model_dump()
    if not data.get("payment_date"):
        from datetime import date
        data["payment_date"] = date.today().isoformat()
    result = create_payment(data, telegram_id=current_user.telegram_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create payment",
        )
    return result


@router.put("/{payment_id}")
async def api_update_payment(payment_id: str, body: PaymentUpdate, current_user: CurrentUser):
    """Update a payment record (Teacher, Admin, Owner)."""
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    success = update_payment(payment_id, data, telegram_id=current_user.telegram_id, role=current_user.role.value)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    return {"status": "ok"}
