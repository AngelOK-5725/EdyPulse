from enum import Enum
from pydantic import BaseModel
from typing import Optional


class AttendanceStatus(str, Enum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    EXCUSED = "excused"
    TRIAL = "trial"


class Attendance(BaseModel):
    id: str
    lesson_id: str = ""
    date: str
    course_id: str = ""
    student_id: str
    status: AttendanceStatus
    comment: Optional[str] = None
    marked_by: Optional[int] = None
    created_at: str = ""
    user_id: str = ""
    updated_at: str = ""
