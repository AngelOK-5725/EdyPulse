"""Column headers for all Google Sheets worksheets.

Extracted from repository files to avoid importing gspread-dependent modules
when only the headers are needed (e.g., in service modules for in-memory stores).
"""

USERS_HEADERS = [
    "id", "telegram_id", "first_name", "last_name",
    "username", "photo_url", "role", "is_active", "created_at",
    "updated_at",
]

COURSES_HEADERS = [
    "id", "title", "description", "days", "time",
    "price", "teacher_id", "color", "student_ids",
    "location", "location_link",
    "is_active", "created_at",
    "user_id", "updated_at",
    # Tariff fields
    "monthly_price", "lesson_price", "lessons_per_week", "payment_type",
]

STUDENTS_HEADERS = [
    "id", "first_name", "last_name", "age", "birth_date",
    "parent_contact", "parent_name", "parent_relation", "phone", "telegram", "course_ids",
    "start_date", "photo_url", "is_active", "created_at",
    "user_id", "updated_at",
]

ATTENDANCE_HEADERS = [
    "id", "lesson_id", "date", "course_id", "student_id",
    "status", "comment", "marked_by", "created_at",
    "user_id", "updated_at",
]

PAYMENTS_HEADERS = [
    "id", "student_id", "course_id", "amount",
    "payment_date", "payment_type",
    "comment", "created_at",
    "user_id", "updated_at",
]

ACHIEVEMENTS_HEADERS = [
    "id", "student_id", "title", "icon",
    "description", "achieved_at", "created_at",
    "user_id", "updated_at",
]

LESSONS_HEADERS = [
    "id", "course_id", "date", "time", "title",
    "status", "rescheduled_to", "homework", "location", "location_link",
    "note", "lesson_type", "is_active", "created_at",
    "user_id", "updated_at",
]
