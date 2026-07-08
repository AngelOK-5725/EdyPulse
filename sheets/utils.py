"""Utility functions for Google Sheets operations."""

from typing import Any
import json


def sheets_row_to_dict(headers: list[str], row: list[str]) -> dict[str, Any]:
    """Convert a Google Sheets row to a dictionary using headers."""
    return {headers[i]: row[i] if i < len(row) else "" for i in range(len(headers))}


def dict_to_sheets_row(data: dict[str, Any], headers: list[str]) -> list[str]:
    """Convert a dictionary to a Google Sheets row matching headers order."""
    return [str(data.get(h, "")) for h in headers]


def generate_id(entity_name: str, existing_ids: list[str]) -> str:
    """Generate a unique ID for a new entity."""
    import uuid
    return f"{entity_name}_{uuid.uuid4().hex[:8]}"


def ensure_headers(
    worksheet: Any, headers: list[str], header_row: int = 1
) -> None:
    """Ensure that the worksheet has the correct headers."""
    existing = worksheet.row_values(header_row)
    if existing != headers:
        # Clear and set headers if they don't match
        worksheet.clear()
        worksheet.append_row(headers)
