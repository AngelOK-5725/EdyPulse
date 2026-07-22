from pydantic import BaseModel
from typing import Optional


class Group(BaseModel):
    id: str
    course_id: str
    name: str
    days: list[str] = []
    start_time: str = ""
    end_time: str = ""
    location: str = ""
    location_link: str = ""
    teacher: str = ""
    student_ids: list[str] = []
    is_active: bool = True
    created_at: str = ""
    user_id: str = ""
    updated_at: str = ""
