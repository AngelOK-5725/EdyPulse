"""Users repository for Google Sheets."""

from sheets.repositories.base import BaseRepository


USERS_HEADERS = [
    "id", "telegram_id", "first_name", "last_name",
    "username", "photo_url", "role", "is_active", "created_at",
    "updated_at",
]


class UsersRepository(BaseRepository):
    """Repository for managing users in Google Sheets."""

    def __init__(self, spreadsheet_id: str):
        super().__init__(
            spreadsheet_id=spreadsheet_id,
            worksheet_name="Users",
            headers=USERS_HEADERS,
        )

    def find_by_telegram_id(self, telegram_id: int) -> dict | None:
        """Find a user by Telegram ID."""
        return self.find(telegram_id=str(telegram_id))[0] if self.find(telegram_id=str(telegram_id)) else None
