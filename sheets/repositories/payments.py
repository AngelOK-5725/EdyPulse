"""Payments repository for Google Sheets."""

from sheets.repositories.base import BaseRepository


PAYMENTS_HEADERS = [
    "id", "student_id", "course_id", "amount",
    "payment_date", "payment_type", "months_covered",
    "comment", "created_at",
]


class PaymentsRepository(BaseRepository):
    """Repository for managing payments in Google Sheets."""

    def __init__(self, spreadsheet_id: str):
        super().__init__(
            spreadsheet_id=spreadsheet_id,
            worksheet_name="Payments",
            headers=PAYMENTS_HEADERS,
        )

    def find_by_student(self, student_id: str) -> list[dict]:
        """Find payments by student ID."""
        return self.find(student_id=student_id)
