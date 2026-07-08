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
    time: str = ""
    title: str = ""
    status: LessonStatus = LessonStatus.SCHEDULED
    rescheduled_to: str = ""
    homework: str = ""
    location: str = ""
    location_link: str = ""
    note: str = ""
    is_active: bool = True
    created_at: str = ""
