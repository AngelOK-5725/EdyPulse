from pydantic import BaseModel
from typing import Optional


class Achievement(BaseModel):
    id: str
    student_id: str
    title: str
    icon: str
    description: Optional[str] = None
    achieved_at: str = ""
    created_at: str = ""
