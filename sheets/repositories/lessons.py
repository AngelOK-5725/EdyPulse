"""Lessons repository for Google Sheets."""

from sheets.repositories.base import BaseRepository

LESSONS_HEADERS = [
    "id", "course_id", "date", "time", "title",
    "status", "rescheduled_to", "homework", "location", "location_link",
    "note", "is_active", "created_at",
    "user_id", "updated_at",
]


class LessonsRepository(BaseRepository):
    """Repository for managing lessons in Google Sheets."""

    def __init__(self, spreadsheet_id: str):
        super().__init__(
            spreadsheet_id=spreadsheet_id,
            worksheet_name="Lessons",
            headers=LESSONS_HEADERS,
        )

    def find_by_course_and_date(self, course_id: str, date: str) -> list[dict]:
        """Find lessons for a specific course on a specific date."""
        return self.find(course_id=course_id, date=date)

    def find_by_date(self, date: str) -> list[dict]:
        """Find all lessons on a specific date."""
        return self.find(date=date)
