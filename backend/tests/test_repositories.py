"""Tests for in-memory repositories and CRUD service layer."""

from sheets.repositories.memory import InMemoryRepository


HEADERS = ["id", "name", "email", "is_active", "created_at"]


def make_repo():
    return InMemoryRepository(HEADERS)


class TestInMemoryRepository:
    """Test CRUD operations on InMemoryRepository."""

    def test_create_and_get_all(self):
        repo = make_repo()
        data = repo.create({"name": "Test", "email": "test@test.com"})
        assert data["name"] == "Test"
        assert data["id"]  # Auto-generated
        assert data["created_at"]  # Auto-generated

        all_records = repo.get_all()
        assert len(all_records) == 1

    def test_get_by_id(self):
        repo = make_repo()
        created = repo.create({"name": "Alice"})
        found = repo.get_by_id(created["id"])
        assert found is not None
        assert found["name"] == "Alice"

    def test_get_by_id_not_found(self):
        repo = make_repo()
        assert repo.get_by_id("nonexistent") is None

    def test_update(self):
        repo = make_repo()
        created = repo.create({"name": "Bob"})
        updated = repo.update(created["id"], {"name": "Robert"})
        assert updated is True
        found = repo.get_by_id(created["id"])
        assert found["name"] == "Robert"

    def test_update_not_found(self):
        repo = make_repo()
        assert repo.update("nonexistent", {"name": "X"}) is False

    def test_soft_delete(self):
        repo = make_repo()
        created = repo.create({"name": "Charlie"})
        deleted = repo.delete(created["id"])
        assert deleted is True
        found = repo.get_by_id(created["id"])
        assert found["is_active"] == "false"

    def test_find(self):
        repo = make_repo()
        repo.create({"name": "Alice", "email": "alice@a.com"})
        repo.create({"name": "Bob", "email": "bob@b.com"})
        repo.create({"name": "Alice", "email": "alice2@a.com"})

        results = repo.find(name="Alice")
        assert len(results) == 2

        results = repo.find(name="Alice", email="alice@a.com")
        assert len(results) == 1

    def test_find_no_match(self):
        repo = make_repo()
        results = repo.find(name="Nobody")
        assert len(results) == 0

    def test_clear(self):
        repo = make_repo()
        repo.create({"name": "A"})
        repo.create({"name": "B"})
        repo.clear()
        assert len(repo.get_all()) == 0


class TestCoursesService:
    """Test course CRUD via service layer."""

    def test_create_and_list(self):
        from backend.app.services.course_service import create_course, list_courses

        # Test with memory mode (no Google Sheets configured)
        course = create_course({
            "title": "Test Course",
            "price": 1000,
            "days": ["Пн", "Ср"],
        })
        assert course is not None
        assert course["title"] == "Test Course"

        courses = list_courses()
        assert len(courses) >= 1
        assert any(c["title"] == "Test Course" for c in courses)

    def test_get_and_delete(self):
        from backend.app.services.course_service import create_course, get_course, delete_course

        course = create_course({"title": "To Delete"})
        cid = course["id"]

        found = get_course(cid)
        assert found is not None

        deleted = delete_course(cid)
        assert deleted is True


class TestStudentsService:
    """Test student CRUD via service layer."""

    def test_create_and_list(self):
        from backend.app.services.student_service import create_student, list_students

        student = create_student({
            "first_name": "Иван",
            "last_name": "Петров",
            "course_ids": ["1"],
        })
        assert student is not None
        assert student["first_name"] == "Иван"

        students = list_students()
        assert len(students) >= 1

    def test_filter_by_course(self):
        from backend.app.services.student_service import create_student, list_students

        create_student({"first_name": "A", "last_name": "B", "course_ids": ["1"]})
        create_student({"first_name": "C", "last_name": "D", "course_ids": ["2"]})

        course1 = list_students(course_id="1")
        assert all("1" in s.get("course_ids", "") for s in course1)


class TestAttendanceService:
    """Test attendance CRUD via service layer."""

    def test_mark_and_list(self):
        from backend.app.services.attendance_service import mark_attendance, list_attendance

        record = mark_attendance({
            "date": "2025-01-15",
            "course_id": "1",
            "student_id": "1",
            "status": "present",
        })
        assert record is not None
        assert record["status"] == "present"

        records = list_attendance(course_id="1", date="2025-01-15")
        assert len(records) >= 1


class TestPaymentsService:
    """Test payment CRUD via service layer."""

    def test_create_and_list(self):
        from backend.app.services.payment_service import create_payment, list_payments

        create_payment({
            "student_id": "1", "course_id": "1",
            "amount": 3000, "payment_type": "monthly",
            "payment_date": "2026-07-01", "comment": "Test",
        })
        create_payment({
            "student_id": "2", "course_id": "1",
            "amount": 1500, "payment_type": "partial",
            "payment_date": "2026-07-05",
        })

        payments = list_payments()
        assert len(payments) >= 2
        assert any(p["student_id"] == "1" for p in payments)


class TestAchievementsService:
    """Test achievement CRUD via service layer."""

    def test_create_and_list(self):
        from backend.app.services.achievement_service import create_achievement, list_achievements

        ach = create_achievement({
            "student_id": "1",
            "title": "Ни одного пропуска",
            "icon": "🏆",
        })
        assert ach is not None
        assert ach["title"] == "Ни одного пропуска"

        achievements = list_achievements(student_id="1")
        assert len(achievements) >= 1
