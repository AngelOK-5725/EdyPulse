from enum import Enum
from pydantic import BaseModel
from typing import Optional


class UserRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    TESTER = "tester"
    USER = "user"


class User(BaseModel):
    # Внутренний идентификатор пользователя.
    # Для новых пользователей генерируется в формате usr_XXXXXXXX (см. user_service._generate_user_id).
    # Для пользователей, созданных до внедрения данной схемы, может хранить числовое значение,
    # равное telegram_id (обратная совместимость).
    # Неизменяем на протяжении всего жизненного цикла пользователя.
    id: str

    # Внешний идентификатор Telegram. Используется исключительно для входа через Telegram WebApp.
    # Может измениться, если пользователь сменит аккаунт Telegram.
    telegram_id: int

    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    role: UserRole = UserRole.USER
    is_active: bool = True
    created_at: str = ""
    updated_at: str = ""
