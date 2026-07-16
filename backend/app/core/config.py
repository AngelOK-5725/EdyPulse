from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "EduPulse"
    VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Telegram
    TELEGRAM_BOT_TOKEN: str = ""

    # Debug fallback — разрешает вход без JWT-токена (только для локальной разработки)
    # ⚠️ На Render (продакшен) должно быть False или не задано!
    # Render env vars:
    #   DEBUG=false
    #   ALLOW_DEBUG_FALLBACK=false (или не указывать, т.к. по умолчанию False)
    ALLOW_DEBUG_FALLBACK: bool = False

    # JWT
    JWT_SECRET: str = "edupulse-jwt-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24

    # Google Sheets
    GOOGLE_SHEETS_CREDENTIALS_FILE: Optional[str] = None
    GOOGLE_SHEETS_PRIVATE_KEY: Optional[str] = None
    GOOGLE_SHEETS_CLIENT_EMAIL: Optional[str] = None
    GOOGLE_SHEETS_SPREADSHEET_ID: Optional[str] = None

    # Owner
    OWNER_TELEGRAM_ID: int = 0

    # CORS
    CORS_ORIGINS: list[str] = ["*"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
