from pydantic import BaseModel
from typing import Optional
from enum import Enum


class PaymentType(str, Enum):
    MONTHLY = "monthly"
    PER_LESSON = "per_lesson"
    MIXED = "mixed"


class Course(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    days: list[str] = []
    time: Optional[str] = None
    price: float = 0.0
    teacher_id: Optional[int] = None
    color: str = "#6C5CE7"
    student_ids: list[str] = []
    location: Optional[str] = None
    location_link: Optional[str] = None
    is_active: bool = True
    created_at: str = ""

    # Tariff fields
    monthly_price: Optional[float] = None
    lesson_price: Optional[float] = None
    lessons_per_week: Optional[int] = None
    payment_type: PaymentType = PaymentType.MONTHLY
