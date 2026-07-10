from pydantic import BaseModel
from typing import Optional
from enum import Enum


class PaymentType(str, Enum):
    MONTHLY = "monthly"
    SINGLE = "single"
    PARTIAL = "partial"
    FULL = "full"


class Payment(BaseModel):
    id: str
    student_id: str
    course_id: str
    amount: float
    payment_date: str
    payment_type: PaymentType = PaymentType.PARTIAL
    comment: Optional[str] = None
    created_at: str = ""
    user_id: str = ""
    updated_at: str = ""
