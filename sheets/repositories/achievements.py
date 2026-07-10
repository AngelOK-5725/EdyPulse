"""Achievements repository for Google Sheets."""

from sheets.repositories.base import BaseRepository


ACHIEVEMENTS_HEADERS = [
    "id", "student_id", "title", "icon",
    "description", "achieved_at", "created_at",
    "user_id", "updated_at",
]


class AchievementsRepository(BaseRepository):
    """Repository for managing achievements in Google Sheets."""

    def __init__(self, spreadsheet_id: str):
        super().__init__(
            spreadsheet_id=spreadsheet_id,
            worksheet_name="Achievements",
            headers=ACHIEVEMENTS_HEADERS,
        )

    def find_by_student(self, student_id: str) -> list[dict]:
        """Find achievements by student ID."""
        return self.find(student_id=student_id)
