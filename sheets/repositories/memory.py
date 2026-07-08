"""In-memory repository — drop-in replacement for Google Sheets repositories.

Used for development and testing without Google Sheets API access.
Data does not persist between restarts.
"""

from typing import Any, Optional
from datetime import datetime, timezone


class InMemoryRepository:
    """In-memory data store that mirrors the BaseRepository interface."""

    def __init__(self, headers: list[str]):
        self.headers = headers
        self._records: list[dict[str, str]] = []
        self._id_counter = 0

    def _generate_id(self) -> str:
        self._id_counter += 1
        now = datetime.now(timezone.utc)
        return f"mem_{now.strftime('%Y%m%d%H%M%S')}_{self._id_counter}"

    def get_all(self) -> list[dict[str, Any]]:
        return [dict(r) for r in self._records]

    def get_by_id(self, record_id: str, id_field: str = "id") -> Optional[dict[str, Any]]:
        for record in self._records:
            if str(record.get(id_field, "")) == record_id:
                return dict(record)
        return None

    def create(self, data: dict[str, Any]) -> dict[str, Any]:
        record = {}
        for h in self.headers:
            record[h] = str(data.get(h, ""))
        # Auto-generate ID if not provided
        if not record.get("id"):
            record["id"] = self._generate_id()
        if "created_at" in self.headers and not record.get("created_at"):
            record["created_at"] = datetime.now(timezone.utc).isoformat()
        self._records.append(record)
        return dict(record)

    def update(self, record_id: str, data: dict[str, Any], id_field: str = "id") -> bool:
        for i, record in enumerate(self._records):
            if str(record.get(id_field, "")) == record_id:
                for key, value in data.items():
                    if key in self.headers:
                        self._records[i][key] = str(value)
                return True
        return False

    def delete(self, record_id: str, id_field: str = "id") -> bool:
        if "is_active" in self.headers:
            return self.update(record_id, {"is_active": "false"}, id_field)
        # Hard delete if no is_active field
        for i, record in enumerate(self._records):
            if str(record.get(id_field, "")) == record_id:
                self._records.pop(i)
                return True
        return False

    def find(self, **kwargs) -> list[dict[str, Any]]:
        results = []
        for record in self._records:
            match = True
            for key, value in kwargs.items():
                if str(record.get(key, "")) != str(value):
                    match = False
                    break
            if match:
                results.append(dict(record))
        return results

    def clear(self):
        """Clear all records (for testing)."""
        self._records.clear()
        self._id_counter = 0
