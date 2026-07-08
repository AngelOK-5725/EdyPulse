"""Students repository for Google Sheets."""

from sheets.repositories.base import BaseRepository


STUDENTS_HEADERS = [
    "id", "first_name", "last_name", "age", "birth_date",
    "parent_contact", "phone", "telegram", "course_ids",
    "start_date", "photo_url", "is_active", "created_at",
]


class StudentsRepository(BaseRepository):
    """Repository for managing students in Google Sheets."""

    def __init__(self, spreadsheet_id: str):
        super().__init__(
            spreadsheet_id=spreadsheet_id,
            worksheet_name="Students",
            headers=STUDENTS_HEADERS,
        )

    def find_by_course(self, course_id: str) -> list[dict]:
        """Find students by course ID."""
        students = self.get_all()
        return [
            s for s in students
            if course_id in s.get("course_ids", "").split(",")
            and s.get("is_active", "true") == "true"
        ]
