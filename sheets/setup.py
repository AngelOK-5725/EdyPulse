#!/usr/bin/env python3
"""Google Sheets setup script — creates EduPulse spreadsheet with all required sheets.

Usage:
    python google/setup.py                  # Uses env vars
    python google/setup.py --credentials creds.json  # Uses file

Requires:
    - GOOGLE_SHEETS_CREDENTIALS_FILE or --credentials
    - GOOGLE_SHEETS_PRIVATE_KEY + GOOGLE_SHEETS_CLIENT_EMAIL (or --credentials)
"""

import argparse
import logging
import os
import sys
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

SHEETS_CONFIG = {
    "Users": [
        "id", "telegram_id", "first_name", "last_name", "username",
        "photo_url", "role", "is_active", "created_at",
        "updated_at",
    ],
    "Courses": [
        "id", "title", "description", "days", "time",
        "price", "teacher_id", "color", "student_ids",
        "is_active", "created_at",
        "user_id", "updated_at",
    ],
    "Students": [
        "id", "first_name", "last_name", "age", "birth_date",
        "parent_contact", "phone", "telegram", "course_ids",
        "start_date", "photo_url", "is_active", "created_at",
        "user_id", "updated_at",
    ],
    "Lessons": [
        "id", "course_id", "group_id", "date", "time", "start_time", "end_time", "title",
        "status", "rescheduled_to", "homework", "location", "location_link",
        "note", "lesson_type", "is_active", "created_at",
        "user_id", "updated_at",
    ],
    "Attendance": [
        "id", "lesson_id", "date", "course_id", "student_id",
        "status", "comment", "marked_by", "created_at",
        "user_id", "updated_at", "is_active",
    ],
    "Payments": [
        "id", "student_id", "course_id", "amount",
        "payment_date", "next_payment_date", "status",
        "comment", "created_at",
        "user_id", "updated_at",
    ],
    "Groups": [
        "id", "course_id", "name", "days", "start_time", "end_time",
        "location", "location_link", "teacher", "student_ids",
        "is_active", "created_at", "user_id", "updated_at",
    ],
    "Achievements": [
        "id", "student_id", "title", "icon",
        "description", "achieved_at", "created_at",
        "user_id", "updated_at",
    ],
}

SAMPLE_DATA = {
    "Users": [
        ["1", "123456", "Admin", "User", "admin_user", "", "admin", "true", "2025-01-01T00:00:00"],
        ["2", "234567", "Teacher", "One", "teacher1", "", "user", "true", "2025-01-01T00:00:00"],
    ],
    "Courses": [
        ["1", "Робототехника Junior", "Основы робототехники для начинающих", "Пн,Ср", "17:00",
         "3000", "1", "#6C5CE7", "1,2", "true", "2025-01-01T00:00:00"],
        ["2", "Scratch", "Визуальное программирование", "Вт,Чт", "18:30",
         "2500", "1", "#00B894", "3", "true", "2025-01-01T00:00:00"],
    ],
    "Students": [
        ["1", "Иван", "Петров", "10", "2015-03-15", "+7 999 111-11-11", "@ivan_p", "1", "2025-01-15", "", "true", "2025-01-01T00:00:00"],
        ["2", "Анна", "Смирнова", "9", "2016-07-22", "+7 999 222-22-22", "@anna_s", "1", "2025-01-15", "", "true", "2025-01-01T00:00:00"],
        ["3", "Михаил", "Кузнецов", "11", "2014-01-10", "+7 999 333-33-33", "@misha_k", "2", "2025-01-20", "", "true", "2025-01-01T00:00:00"],
    ],
}


def setup_spreadsheet(
    spreadsheet_title: str = "EduPulse",
    credentials_file: Optional[str] = None,
    private_key: Optional[str] = None,
    client_email: Optional[str] = None,
    add_sample_data: bool = True,
) -> str:
    """Create a new Google Spreadsheet with all required sheets and headers.

    Returns the spreadsheet ID.
    """
    import gspread
    from google.oauth2.service_account import Credentials

    SCOPES = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]

    if credentials_file:
        creds = Credentials.from_service_account_file(credentials_file, scopes=SCOPES)
        source_desc = f"credentials file: {credentials_file}"
    elif private_key and client_email:
        creds = Credentials.from_service_account_info(
            {
                "type": "service_account",
                "private_key": private_key,
                "client_email": client_email,
                "token_uri": "https://oauth2.googleapis.com/token",
            },
            scopes=SCOPES,
        )
        source_desc = f"service account: {client_email}"
    else:
        raise ValueError("Provide --credentials or set GOOGLE_SHEETS_CREDENTIALS_FILE")

    client = gspread.authorize(creds)
    logger.info(f"Authenticated with {source_desc}")

    # Create spreadsheet
    spreadsheet = client.create(spreadsheet_title)
    spreadsheet_id = spreadsheet.id
    logger.info(f"Created spreadsheet: '{spreadsheet_title}' (ID: {spreadsheet_id})")

    # Rename default sheet and create others
    default_sheet = spreadsheet.get_worksheet(0)
    sheet_names = list(SHEETS_CONFIG.keys())

    # Rename first sheet
    default_sheet.update_title(sheet_names[0])

    # Add remaining sheets
    for name in sheet_names[1:]:
        spreadsheet.add_worksheet(title=name, rows=100, cols=len(SHEETS_CONFIG[name]))

    # Set headers and sample data
    for name, headers in SHEETS_CONFIG.items():
        worksheet = spreadsheet.worksheet(name)
        worksheet.append_row(headers)

        if add_sample_data and name in SAMPLE_DATA:
            for row in SAMPLE_DATA[name]:
                worksheet.append_row(row)
            logger.info(f"  {name}: {len(SAMPLE_DATA[name])} sample rows added")

    logger.info(f"\n✅ Spreadsheet ready! Add this to your .env:\n")
    print(f"GOOGLE_SHEETS_SPREADSHEET_ID={spreadsheet_id}")

    # Share with service account for access
    try:
        from googleapiclient.discovery import build
        service = build("drive", "v3", credentials=creds)
        # Share with the service account itself (implicitly has access)
        logger.info("Spreadsheet is accessible by the service account")
    except Exception:
        pass

    return spreadsheet_id


def main():
    parser = argparse.ArgumentParser(description="Create EduPulse Google Sheets spreadsheet")
    parser.add_argument("--credentials", help="Path to service account JSON file")
    parser.add_argument("--title", default="EduPulse", help="Spreadsheet title")
    parser.add_argument("--no-sample-data", action="store_true", help="Skip sample data")
    args = parser.parse_args()

    credentials_file = args.credentials or os.getenv("GOOGLE_SHEETS_CREDENTIALS_FILE")
    private_key = os.getenv("GOOGLE_SHEETS_PRIVATE_KEY")
    client_email = os.getenv("GOOGLE_SHEETS_CLIENT_EMAIL")

    if not credentials_file and not (private_key and client_email):
        print("Error: Provide --credentials or set GOOGLE_SHEETS_CREDENTIALS_FILE in .env")
        print("\nOr set both GOOGLE_SHEETS_PRIVATE_KEY and GOOGLE_SHEETS_CLIENT_EMAIL")
        sys.exit(1)

    setup_spreadsheet(
        spreadsheet_title=args.title,
        credentials_file=credentials_file,
        private_key=private_key,
        client_email=client_email,
        add_sample_data=not args.no_sample_data,
    )


if __name__ == "__main__":
    main()
