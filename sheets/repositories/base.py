"""Base repository for Google Sheets operations."""

from typing import Any, Optional
from sheets.client import google_sheets_client
from sheets.utils import ensure_headers, sheets_row_to_dict, dict_to_sheets_row


class BaseRepository:
    """Abstract base repository for Google Sheets."""

    def __init__(
        self,
        spreadsheet_id: str,
        worksheet_name: str,
        headers: list[str],
        header_row: int = 1,
    ):
        self.spreadsheet_id = spreadsheet_id
        self.worksheet_name = worksheet_name
        self.headers = headers
        self.header_row = header_row

    def _get_worksheet(self):
        """Get the worksheet instance."""
        return google_sheets_client.get_worksheet(
            self.spreadsheet_id, self.worksheet_name
        )

    def _ensure_headers(self):
        """Ensure headers exist in the worksheet."""
        worksheet = self._get_worksheet()
        ensure_headers(worksheet, self.headers, self.header_row)

    def get_all(self) -> list[dict[str, Any]]:
        """Get all records from the worksheet."""
        self._ensure_headers()
        worksheet = self._get_worksheet()
        rows = worksheet.get_all_records()
        return rows

    def get_by_id(self, record_id: str, id_field: str = "id") -> Optional[dict[str, Any]]:
        """Get a single record by ID."""
        records = self.get_all()
        for record in records:
            if str(record.get(id_field, "")) == record_id:
                return record
        return None

    def create(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create a new record."""
        self._ensure_headers()
        worksheet = self._get_worksheet()
        row = dict_to_sheets_row(data, self.headers)
        worksheet.append_row(row)
        return data

    def update(self, record_id: str, data: dict[str, Any], id_field: str = "id") -> bool:
        """Update a record by ID."""
        self._ensure_headers()
        worksheet = self._get_worksheet()
        records = worksheet.get_all_records()

        for i, record in enumerate(records):
            if str(record.get(id_field, "")) == record_id:
                row_number = i + self.header_row + 1
                for key, value in data.items():
                    if key in self.headers:
                        col_index = self.headers.index(key) + 1
                        worksheet.update_cell(row_number, col_index, str(value))
                return True
        return False

    def delete(self, record_id: str, id_field: str = "id") -> bool:
        """Delete a record by ID (marks is_active=False if available, otherwise deletes row)."""
        if "is_active" in self.headers:
            return self.update(record_id, {"is_active": "false"}, id_field)
        return False

    def find(self, **kwargs) -> list[dict[str, Any]]:
        """Find records matching all provided field=value pairs."""
        records = self.get_all()
        results = []
        for record in records:
            match = True
            for key, value in kwargs.items():
                if str(record.get(key, "")) != str(value):
                    match = False
                    break
            if match:
                results.append(record)
        return results
