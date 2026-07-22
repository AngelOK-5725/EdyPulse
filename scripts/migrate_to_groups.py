#!/usr/bin/env python3
"""
Migration script: convert legacy lessons → Course → Group → Lesson architecture.

Этап 2 миграции:
  1. Собирает все существующие занятия (lessons) по курсам
  2. Группирует по (course_id, day_of_week, start_time)
  3. Для каждой группы собирает уникальных учеников из attendance
  4. Создаёт Group для каждой такой группы
  5. Обновляет все уроки: добавляет group_id
  6. Переносит student_ids из курсов в группы

Usage:
    python scripts/migrate_to_groups.py
"""

import logging
import sys
import os
from datetime import datetime
from collections import defaultdict
from uuid import uuid4

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ─── Day name → number map ─────────────────────────────────────────────────
WEEKDAY_MAP = {
    "Пн": 0, "Вт": 1, "Ср": 2, "Чт": 3, "Пт": 4, "Сб": 5, "Вс": 6,
}
NUM_TO_DAY = {v: k for k, v in WEEKDAY_MAP.items()}


def get_day_of_week(date_str: str) -> str:
    """Get Russian day-of-week name from ISO date string."""
    from datetime import date
    d = date.fromisoformat(date_str)
    return NUM_TO_DAY[d.weekday()]


def main():
    """Run the migration."""
    from backend.app.services.lesson_service import list_lessons, update_lesson
    from backend.app.services.group_service import create_group, list_groups
    from backend.app.services.course_service import get_course, update_course
    from backend.app.services.attendance_service import list_attendance

    logger.info("=" * 60)
    logger.info("Starting migration: lessons → groups")
    logger.info("=" * 60)

    # ── Step 1: Get all active lessons ────────────────────────────────────
    all_lessons = list_lessons()
    active_lessons = [l for l in all_lessons if l.get("is_active", "true") == "true"]
    logger.info(f"Found {len(active_lessons)} active lessons")

    if not active_lessons:
        logger.info("No lessons to migrate — nothing to do.")
        return

    # ── Step 2: Get all attendance records ─────────────────────────────────
    all_attendance = list_attendance()
    logger.info(f"Found {len(all_attendance)} attendance records")

    # Build attendance-by-lesson map
    attendance_by_lesson: dict[str, set[str]] = defaultdict(set)
    for a in all_attendance:
        lesson_id = a.get("lesson_id", "")
        student_id = a.get("student_id", "")
        if lesson_id and student_id:
            attendance_by_lesson[lesson_id].add(student_id)

    # ── Step 3: Group lessons by (course_id, day_of_week, start_time) ──────
    groups_map: dict[tuple, list[dict]] = defaultdict(list)
    for lesson in active_lessons:
        date_str = lesson.get("date", "")
        start_time = lesson.get("start_time", "") or lesson.get("time", "")
        course_id = lesson.get("course_id", "")
        if not date_str or not course_id:
            continue

        try:
            day_name = get_day_of_week(date_str)
        except (ValueError, KeyError):
            logger.warning(f"  ⚠ Could not parse date '{date_str}' for lesson {lesson.get('id')}")
            continue

        key = (course_id, day_name, start_time)
        groups_map[key].append(lesson)

    logger.info(f"Found {len(groups_map)} unique group candidates")

    # ── Step 4: Create groups and update lessons ──────────────────────────
    # Check existing groups to avoid duplicates
    existing_groups_map: dict[tuple, str] = {}
    try:
        existing_all = list_groups()
        for eg in existing_all:
            key = (eg.get("course_id", ""), eg.get("start_time", ""))
            if key not in existing_groups_map:
                existing_groups_map[key] = eg.get("id", "")
    except Exception as e:
        logger.warning(f"Could not load existing groups: {e}")

    created_count = 0
    updated_count = 0

    for (course_id, day_name, start_time), lessons in groups_map.items():
        # Get course info
        course = get_course(course_id)
        if not course:
            logger.warning(f"  ⚠ Course {course_id} not found, skipping group")
            continue

        course_title = course.get("title", "Курс")

        # Collect unique students from all lessons in this group
        all_student_ids: set[str] = set()
        for lesson in lessons:
            lesson_id = lesson.get("id", "")
            student_ids = attendance_by_lesson.get(lesson_id, set())
            all_student_ids.update(student_ids)

        # Also check course.student_ids as fallback
        course_student_ids_str = course.get("student_ids", "")
        if course_student_ids_str:
            course_student_ids = set(
                s.strip() for s in course_student_ids_str.split(",") if s.strip()
            )
            all_student_ids.update(course_student_ids)

        # Determine end_time from any lesson that has it
        end_time = ""
        for lesson in lessons:
            et = lesson.get("end_time", "")
            if et:
                end_time = et
                break

        # Build days list — collect all distinct days for this course
        days_list = [day_name]
        course_days_str = course.get("days", "")
        if course_days_str:
            course_days = [d.strip() for d in course_days_str.split(",") if d.strip()]
            days_list = course_days  # prefer course days

        # Generate group name
        group_name = f"{course_title} ({day_name} {start_time})"

        # Check if a group already exists for this course+time
        existing_key = (course_id, start_time)
        existing_group_id = existing_groups_map.get(existing_key, "")
        if existing_group_id:
            group_id = existing_group_id
            logger.info(f"  ℹ Group already exists for '{group_name}' (id={group_id}), updating lessons...")
        else:
            # Create group via service function
            group_data = {
                "id": f"grp_{uuid4().hex[:8]}",
                "course_id": course_id,
                "name": group_name,
                "days": days_list,
                "start_time": start_time,
                "end_time": end_time,
                "location": course.get("location", ""),
                "location_link": course.get("location_link", ""),
                "teacher": "",
                "student_ids": sorted(all_student_ids) if all_student_ids else [],
            }
            try:
                result = create_group(group_data)
                if result:
                    group_id = result.get("id", "")
                    created_count += 1
                    existing_groups_map[existing_key] = group_id
                    logger.info(f"  ✅ Created group '{group_name}' ({group_id}) — {len(all_student_ids)} students")
                else:
                    logger.error(f"  ❌ Failed to create group '{group_name}'")
                    continue
            except Exception as e:
                logger.error(f"  ❌ Failed to create group '{group_name}': {e}")
                continue

        # Update all lessons in this group with group_id
        for lesson in lessons:
            lesson_id = lesson.get("id", "")
            if lesson_id and not lesson.get("group_id"):
                try:
                    # Use the update_lesson service function
                    update_lesson(lesson_id, {"group_id": group_id})
                    updated_count += 1
                except Exception as e:
                    logger.warning(f"  ⚠ Failed to update lesson {lesson_id}: {e}")

    logger.info("=" * 60)
    logger.info(f"Migration complete: created {created_count} groups, updated {updated_count} lessons")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
