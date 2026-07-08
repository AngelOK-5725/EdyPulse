"""Inbox service — aggregates actionable signals for the teacher's daily flow.

Returns items grouped by category (lessons, payments, trials, attention, actions)
so the inbox scales gracefully even with many students and courses.
"""

import logging
from datetime import date, datetime, timedelta
from typing import Any

from backend.app.services.lesson_service import ensure_today_lessons, enrich_lesson_with_attendance
from backend.app.services.course_service import list_courses
from backend.app.services.student_service import list_students
from backend.app.services.attendance_service import list_attendance
from backend.app.services.payment_service import list_payments

logger = logging.getLogger(__name__)


def get_inbox() -> dict[str, Any]:
    """Build the inbox — grouped by category so it scales."""
    today_str = date.today().isoformat()
    now = datetime.now()
    current_time = now.strftime("%H:%M")

    courses = list_courses()
    all_students = list_students()
    all_payments = list_payments()
    today_attendance = list_attendance(date=today_str)
    today_lessons = ensure_today_lessons(courses)

    # Pre-load all attendance records grouped by student_id to avoid N+1
    all_attendance = list_attendance()
    student_attendance_map: dict[str, list[dict]] = {}
    for a in all_attendance:
        sid = a.get("student_id", "")
        if sid not in student_attendance_map:
            student_attendance_map[sid] = []
        student_attendance_map[sid].append(a)

    lesson_items: list[dict[str, Any]] = []
    payment_items: list[dict[str, Any]] = []
    trial_items: list[dict[str, Any]] = []
    attention_items: list[dict[str, Any]] = []

    # ── 1. TODAY'S LESSONS ────────────────────────────────────────────────
    for lesson in today_lessons:
        enriched = enrich_lesson_with_attendance(lesson, all_students, today_attendance)
        stats = enriched.get("attendance_stats", {})
        unmarked = stats.get("unmarked", 0)
        lesson_time = lesson.get("time", "")

        # Determine priority
        if unmarked > 0:
            if lesson_time and lesson_time <= current_time:
                priority = "high"
            else:
                priority = "medium"
        else:
            priority = "low"

        trial_count = stats.get("trial", 0)
        title = lesson.get("title", "Занятие")
        time_str = lesson_time if lesson_time else ""

        # Subtitle shows extra info
        subtitle_parts = []
        if unmarked > 0:
            subtitle_parts.append(f"{unmarked} не отмечены")
        else:
            subtitle_parts.append("Все отмечены")
        if trial_count > 0:
            subtitle_parts.append(f"🌟 {trial_count} пробных")
        subtitle = " · ".join(subtitle_parts)

        action_label = f"Отметить {unmarked}" if unmarked > 0 else "Все отмечены ✓"

        lesson_items.append({
            "id": f"lesson_{lesson.get('id', '')}",
            "title": f"{time_str} {title}" if time_str else title,
            "subtitle": subtitle,
            "priority": priority,
            "action_label": action_label,
            "action_url": f"/lesson/{lesson.get('id', '')}",
            "lesson_id": lesson.get("id", ""),
        })

    # ── 2. TRIAL STUDENTS ─────────────────────────────────────────────────
    # Students marked as trial today
    trial_ids_today = set()
    for a in today_attendance:
        if a.get("status") == "trial":
            trial_ids_today.add(a.get("student_id", ""))

    # New students added recently (within 3 days) with trial status
    three_days_ago = (date.today() - timedelta(days=3)).isoformat()

    for s in all_students:
        sid = s.get("id", "")
        if sid in trial_ids_today:
            continue
        created = s.get("created_at", "").split("T")[0]
        if created and created >= three_days_ago:
            s_att = student_attendance_map.get(sid, [])
            if not s_att or all(a.get("status") == "trial" for a in s_att):
                name = f"{s.get('first_name', '')} {s.get('last_name', '')}".strip()
                trial_items.append({
                    "id": f"trial_{sid}",
                    "title": name or sid,
                    "subtitle": "Новый ученик · пробное",
                    "priority": "medium",
                    "action_label": "Открыть карточку",
                    "action_url": f"/student/{sid}",
                    "student_id": sid,
                })

    # ── 3. PAYMENT ISSUES ─────────────────────────────────────────────────
    thirty_days_ago = (date.today() - timedelta(days=30)).isoformat()

    for s in all_students:
        sid = s.get("id", "")
        name = f"{s.get('first_name', '')} {s.get('last_name', '')}".strip()

        if s.get("is_active", "true") != "true":
            continue

        student_payments = [p for p in all_payments if p.get("student_id") == sid]

        if not student_payments:
            payment_items.append({
                "id": f"payment_no_{sid}",
                "title": name or sid,
                "subtitle": "Нет оплат · проверьте",
                "priority": "high",
                "action_label": "Добавить платеж",
                "action_url": f"/student/{sid}",
                "student_id": sid,
            })
            continue

        sorted_p = sorted(student_payments, key=lambda p: p.get("payment_date", ""), reverse=True)
        last_payment_date = sorted_p[0].get("payment_date", "")

        if last_payment_date < thirty_days_ago:
            payment_items.append({
                "id": f"payment_overdue_{sid}",
                "title": name or sid,
                "subtitle": f"Просрочена · последний платёж {last_payment_date}",
                "priority": "high",
                "action_label": "Добавить платеж",
                "action_url": f"/student/{sid}",
                "student_id": sid,
            })
        elif last_payment_date < (date.today() - timedelta(days=25)).isoformat():
            days_since = (date.today() - date.fromisoformat(last_payment_date)).days
            payment_items.append({
                "id": f"payment_soon_{sid}",
                "title": name or sid,
                "subtitle": f"Скоро · {days_since} дней без оплаты",
                "priority": "low",
                "action_label": "Проверить",
                "action_url": f"/student/{sid}",
                "student_id": sid,
            })

    # ── 4. LONG-ABSENT STUDENTS (attention) ──────────────────────────────
    fourteen_days_ago = (date.today() - timedelta(days=14)).isoformat()

    for s in all_students:
        sid = s.get("id", "")
        name = f"{s.get('first_name', '')} {s.get('last_name', '')}".strip()

        if s.get("is_active", "true") != "true":
            continue

        s_att = student_attendance_map.get(sid, [])
        if not s_att:
            continue

        visits = [a for a in s_att if a.get("status") in ("present", "late")]
        if not visits:
            continue

        last_visit = max(v.get("date", "") for v in visits)
        if last_visit < fourteen_days_ago:
            days_absent = (date.today() - date.fromisoformat(last_visit)).days
            attention_items.append({
                "id": f"absent_{sid}",
                "title": name or sid,
                "subtitle": f"Не был {days_absent} дней · последний визит {last_visit}",
                "priority": "medium",
                "action_label": "Связаться",
                "action_url": f"/student/{sid}",
                "student_id": sid,
            })

    # ── 5. QUICK ACTIONS ──────────────────────────────────────────────────
    action_items = [
        {
            "id": "action_new_student",
            "title": "➕ Новый ученик",
            "subtitle": "Добавить и записать на курс",
            "priority": "low",
            "action_label": "Добавить",
            "action_url": "/admin/students",
        },
        {
            "id": "action_new_lesson",
            "title": "📅 Разовое занятие",
            "subtitle": "Отработка, открытый урок или праздник",
            "priority": "low",
            "action_label": "Создать",
            "action_url": "/admin/courses",
        },
    ]

    # ── SORT within each group: high → medium → low ────────────────────────
    priority_value = {"high": 0, "medium": 1, "low": 2}

    def sort_key(item: dict) -> int:
        return priority_value.get(item.get("priority", "low"), 99)

    lesson_items.sort(key=sort_key)
    payment_items.sort(key=sort_key)
    trial_items.sort(key=sort_key)
    attention_items.sort(key=sort_key)

    # ── BUILD GROUPS (only non-empty groups, plus actions) ─────────────────
    groups: list[dict[str, Any]] = []

    if lesson_items:
        groups.append({
            "key": "lessons",
            "label": "Занятия",
            "icon": "📚",
            "items": lesson_items,
        })
    if payment_items:
        groups.append({
            "key": "payments",
            "label": "Оплаты",
            "icon": "💰",
            "items": payment_items,
        })
    if trial_items:
        groups.append({
            "key": "trials",
            "label": "Пробные",
            "icon": "🌟",
            "items": trial_items,
        })
    if attention_items:
        groups.append({
            "key": "attention",
            "label": "Требуют внимания",
            "icon": "⚠",
            "items": attention_items,
        })

    # Actions always shown
    groups.append({
        "key": "actions",
        "label": "Быстрые действия",
        "icon": "⚡",
        "items": action_items,
    })

    # ── STATS ──────────────────────────────────────────────────────────────
    all_items = lesson_items + payment_items + trial_items + attention_items + action_items
    high_count = sum(1 for i in all_items if i.get("priority") == "high")

    return {
        "date": today_str,
        "groups": groups,
        "stats": {
            "total": len(all_items),
            "high_priority": high_count,
        },
    }
