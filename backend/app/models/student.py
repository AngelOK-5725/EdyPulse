from pydantic import BaseModel
from typing import Optional


class Student(BaseModel):
    id: str
    first_name: str
    last_name: str
    age: Optional[int] = None
    birth_date: Optional[str] = None
    parent_contact: Optional[str] = None
    parent_name: Optional[str] = None
    parent_relation: Optional[str] = None
    phone: Optional[str] = None
    telegram: Optional[str] = None
    course_ids: list[str] = []
    start_date: Optional[str] = None
    photo_url: Optional[str] = None
    is_active: bool = True
    created_at: str = ""
    user_id: str = ""
    updated_at: str = ""
