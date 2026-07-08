# Lazy imports — repositories are imported on demand in service modules
# to avoid triggering gspread import chain at package load time.
# Use like: from sheets.repositories.users import UsersRepository

from .memory import InMemoryRepository

__all__ = [
    "InMemoryRepository",
]
