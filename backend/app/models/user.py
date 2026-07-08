from enum import Enum
from pydantic import BaseModel
from typing import Optional


class UserRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    TESTER = "tester"
    USER = "user"


class User(BaseModel):
    id: int
    telegram_id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    role: UserRole = UserRole.USER
    is_active: bool = True
    created_at: str = ""
