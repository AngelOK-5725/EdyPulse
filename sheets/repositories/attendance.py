"""Attendance repository for Google Sheets."""

from sheets.repositories.base import BaseRepository


ATTENDANCE_HEADERS = [
    "id", "date", "course_id", "student_id",
    "status", "comment", "marked_by", "created_at",
    "user_id", "updated_at",
]


class AttendanceRepository(BaseRepository):
    """Repository for managing attendance records in Google Sheets."""

    def __init__(self, spreadsheet_id: str):
        super().__init__(
            spreadsheet_id=spreadsheet_id,
            worksheet_name="Attendance",
            headers=ATTENDANCE_HEADERS,
        )

    def find_by_course_and_date(self, course_id: str, date: str) -> list[dict]:
        """Find attendance records by course and date."""
        return self.find(course_id=course_id, date=date)

    def find_by_student(self, student_id: str) -> list[dict]:
        """Find all attendance records for a student."""
        return self.find(student_id=student_id)
