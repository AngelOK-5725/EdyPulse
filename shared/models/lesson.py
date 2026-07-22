from enum import Enum
from pydantic import BaseModel
from typing import Optional


class LessonStatus(str, Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"


class Lesson(BaseModel):
    id: str
    course_id: str = ""
    date: str
    time: str = ""               # Legacy: single time field, kept for backward compat
    start_time: str = ""         # New: lesson start time (HH:MM)
    end_time: str = ""           # New: lesson end time (HH:MM)
    title: str = ""
    status: LessonStatus = LessonStatus.SCHEDULED
    rescheduled_to: str = ""
    homework: str = ""
    location: str = ""
    location_link: str = ""
    note: str = ""
    is_active: bool = True
    created_at: str = ""
    user_id: str = ""
    updated_at: str = ""
