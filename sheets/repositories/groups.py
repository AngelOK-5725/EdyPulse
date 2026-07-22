"""Groups repository for Google Sheets."""

from sheets.repositories.base import BaseRepository


GROUPS_HEADERS = [
    "id", "course_id", "name", "days", "start_time", "end_time",
    "location", "location_link", "teacher", "student_ids",
    "is_active", "created_at", "user_id", "updated_at",
]


class GroupsRepository(BaseRepository):
    """Repository for managing groups in Google Sheets."""

    def __init__(self, spreadsheet_id: str):
        super().__init__(
            spreadsheet_id=spreadsheet_id,
            worksheet_name="Groups",
            headers=GROUPS_HEADERS,
        )

    def find_by_course(self, course_id: str) -> list[dict]:
        """Find active groups by course ID."""
        groups = self.get_all()
        return [
            g for g in groups
            if g.get("course_id", "") == course_id
            and g.get("is_active", "true") == "true"
        ]

    def get_active(self) -> list[dict]:
        """Get all active groups."""
        groups = self.get_all()
        return [g for g in groups if g.get("is_active", "true") == "true"]
