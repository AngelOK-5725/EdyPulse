"""Courses repository for Google Sheets."""

from sheets.repositories.base import BaseRepository


COURSES_HEADERS = [
    "id", "title", "description", "days", "time", "duration",
    "price", "teacher_id", "color", "student_ids",
    "location", "location_link",
    "is_active", "created_at",
    "user_id", "updated_at",
    "monthly_price", "lesson_price", "lessons_per_week", "payment_type",
]


class CoursesRepository(BaseRepository):
    """Repository for managing courses in Google Sheets."""

    def __init__(self, spreadsheet_id: str):
        super().__init__(
            spreadsheet_id=spreadsheet_id,
            worksheet_name="Courses",
            headers=COURSES_HEADERS,
        )

    def find_by_teacher(self, teacher_id: int) -> list[dict]:
        """Find courses by teacher ID."""
        return self.find(teacher_id=str(teacher_id), is_active="true")
