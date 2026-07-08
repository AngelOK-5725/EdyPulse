"""Google Sheets client setup and management."""

import os
from typing import Optional
import gspread
from google.oauth2.service_account import Credentials


SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


class GoogleSheetsClient:
    """Singleton wrapper around gspread client."""

    _instance: Optional["GoogleSheetsClient"] = None
    _client: Optional[gspread.Client] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def initialize(
        self,
        credentials_file: Optional[str] = None,
        private_key: Optional[str] = None,
        client_email: Optional[str] = None,
    ):
        """Initialize the Google Sheets client.

        Supports two authentication methods:
        1. Service account file (recommended for local dev)
        2. Private key and client email (recommended for production)
        """
        if credentials_file:
            creds = Credentials.from_service_account_file(
                credentials_file, scopes=SCOPES
            )
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
        else:
            raise ValueError(
                "Either credentials_file or (private_key and client_email) must be provided"
            )

        self._client = gspread.authorize(creds)

    def get_client(self) -> gspread.Client:
        """Get the authorized gspread client."""
        if self._client is None:
            raise RuntimeError(
                "GoogleSheetsClient not initialized. Call initialize() first."
            )
        return self._client

    def open_spreadsheet(self, spreadsheet_id: str) -> gspread.Spreadsheet:
        """Open a spreadsheet by ID."""
        return self.get_client().open_by_key(spreadsheet_id)

    def get_worksheet(self, spreadsheet_id: str, worksheet_name: str) -> gspread.Worksheet:
        """Get a specific worksheet from a spreadsheet."""
        spreadsheet = self.open_spreadsheet(spreadsheet_id)
        return spreadsheet.worksheet(worksheet_name)


# Global instance for dependency injection
google_sheets_client = GoogleSheetsClient()
