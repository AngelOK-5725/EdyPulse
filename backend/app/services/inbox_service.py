"""Inbox service — aggregates actionable signals for the teacher's daily flow.

Returns items grouped by category (lessons, payments, trials, attention)
so the inbox scales gracefully even with many students and courses."""

import logging
from datetime import date, datetime, timedelta
from typing import Any, Optional

from backend.app.services.lesson_service import ensure_today_lessons, enrich_lesson_with_attendance, list_lessons
from backend.app.services.course_service import list_courses
from backend.app.services.student_service import list_students
from backend.app.services.attendance_service import list_attendance
from backend.app.services.payment_service import list_payments

logger = logging.getLogger(__name__)


def get_inbox(telegram_id: Optional[int] = None, role: Optional[str] = None) -> dict[str, Any]:
    """Build the inbox — grouped by category so it scales."""
    today_str = date.today().isoformat()
    now = datetime.now()
    current_time = now.strftime("%H:%M")

    courses = list_courses(telegram_id=telegram_id, role=role)
    all_students = list_students(telegram_id=telegram_id, role=role)
    all_payments = list_payments(telegram_id=telegram_id, role=role)
    today_attendance = list_attendance(date=today_str, telegram_id=telegram_id, role=role)
    today_lessons = ensure_today_lessons(courses, telegram_id=telegram_id)

    # ── Also fetch manually created one-time / make-up lessons for today ──
    # ensure_today_lessons only creates lessons for courses whose weekday
    # matches today.  One-time (разовые) lessons created via the UI are
    # missed.  We merge them here, deduplicating by lesson id.
    manual_today = list_lessons(date_str=today_str, telegram_id=telegram_id, role=role)
    seen_ids = {l.get("id") for l in today_lessons if l.get("id")}
    for ml in manual_today:
        if ml.get("id") not in seen_ids:
            today_lessons.append(ml)
            seen_ids.add(ml.get("id"))

    # Pre-load all attendance records grouped by student_id to avoid N+1
    all_attendance = list_attendance(telegram_id=telegram_id, role=role)
    student_attendance_map: dict[str, list[dict]] = {}
    for a in all_attendance:
        sid = a.get("student_id", "")
        if sid not in student_attendance_map:
            student_attendance_map[sid] = []
        student_attendance_map[sid].append(a)

    cancelled_items: list[dict[str, Any]] = []
    lesson_items: list[dict[str, Any]] = []
    payment_items: list[dict[str, Any]] = []
    trial_items: list[dict[str, Any]] = []
    attention_items: list[dict[str, Any]] = []

    # ── 1. TODAY'S LESSONS ────────────────────────────────────────────────
    for lesson in today_lessons:
        enriched = enrich_lesson_with_attendance(lesson, all_students, today_attendance)
        stats = enriched.get("attendance_stats", {})
        unmarked = stats.get("unmarked", 0)
        # Time display: use start_time/end_time if available, fall back to legacy time
        lesson_time_raw = lesson.get("time", "")
        lesson_start = lesson.get("start_time", "") or lesson_time_raw
        lesson_end = lesson.get("end_time", "")
        if lesson_start and lesson_end:
            time_display = f"{lesson_start} — {lesson_end}"
        else:
            time_display = lesson_start or lesson_time_raw

        # Student count
        student_count = enriched.get("student_count", 0)
        color = enriched.get("color", "#6C5CE7")

        # Determine priority and status (use raw lesson_start for comparison)
        if unmarked > 0:
            if lesson_start and lesson_start <= current_time:
                priority = "high"
            else:
                priority = "medium"
        else:
            priority = "low"

        # Time until lesson (human-readable, use raw lesson_start)
        time_until = ""
        lesson_status = "upcoming"
        if lesson_start:
            try:
                lesson_h, lesson_m = lesson_start.split(":")
                lesson_minutes = int(lesson_h) * 60 + int(lesson_m)
                now_h, now_m = now.strftime("%H:%M").split(":")
                now_minutes = int(now_h) * 60 + int(now_m)
                diff = lesson_minutes - now_minutes
                if diff > 120:
                    time_until = f"Через {diff // 60} ч {diff % 60} мин"
                    lesson_status = "upcoming"
                elif diff > 0:
                    time_until = f"Через {diff} мин"
                    lesson_status = "upcoming"
                elif diff > -60:
                    time_until = "Сейчас"
                    lesson_status = "current"
                elif diff > -120:
                    time_until = f"Прошло {abs(diff)} мин"
                    lesson_status = "past"
                else:
                    time_until = f"Прошло {abs(diff) // 60} ч"
                    lesson_status = "past"
            except (ValueError, ZeroDivisionError):
                pass

        trial_count = stats.get("trial", 0)
        title = lesson.get("title", "Занятие")

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
            "title": f"{time_display} {title}" if time_display else title,
            "subtitle": subtitle,
            "priority": priority,
            "action_label": action_label,
            "action_url": f"/lesson/{lesson.get('id', '')}",
            "lesson_id": lesson.get("id", ""),
            # Rich lesson data
            "lesson_time": time_display,
            "student_count": student_count,
            "color": color,
            "time_until": time_until,
            "lesson_status": lesson_status,
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

    # ── 5. CANCELLED LESSONS (need make-up) ──────────────────────────────
    # Show cancelled lessons from the last 14 days that need a make-up
    # (fourteen_days_ago is already defined above)
    all_lessons = list_lessons(telegram_id=telegram_id, role=role)
    for lesson in all_lessons:
        if lesson.get("status") != "cancelled":
            continue
        lesson_date = lesson.get("date", "")
        if lesson_date < fourteen_days_ago:
            continue

        course_id = lesson.get("course_id", "")
        title = lesson.get("title", "") or "Занятие"
        course_title = ""
        for c in courses:
            if c.get("id") == course_id:
                course_title = c.get("title", "")
                break

        display_title = title
        if course_title and title != course_title:
            display_title = f"{title} ({course_title})"

        cancelled_items.append({
            "id": f"cancelled_{lesson.get('id', '')}",
            "title": f"❌ {display_title}",
            "subtitle": f"Отменено {lesson_date} · требуется перенос",
            "priority": "high",
            "action_label": "Перенести",
            "action_url": f"/school/lessons",
            "lesson_id": lesson.get("id", ""),
        })

    # ── SORT within each group: high → medium → low ────────────────────────
    priority_value = {"high": 0, "medium": 1, "low": 2}

    def sort_key(item: dict) -> int:
        return priority_value.get(item.get("priority", "low"), 99)

    lesson_items.sort(key=sort_key)
    payment_items.sort(key=sort_key)
    trial_items.sort(key=sort_key)
    attention_items.sort(key=sort_key)

    # ── BUILD GROUPS (only non-empty groups) ──────────────────────────────
    groups: list[dict[str, Any]] = []

    # Lessons group is ALWAYS shown, even when empty — gives the teacher
    # a consistent anchor point. Empty state is handled on the frontend.
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

    # Cancelled lessons (if any)
    if cancelled_items:
        groups.append({
            "key": "cancelled",
            "label": "Отменённые",
            "icon": "❌",
            "items": cancelled_items,
        })

    # ── STATS ──────────────────────────────────────────────────────────────
    all_items = lesson_items + payment_items + trial_items + attention_items + cancelled_items
    high_count = sum(1 for i in all_items if i.get("priority") == "high")

    return {
        "date": today_str,
        "groups": groups,
        "stats": {
            "total": len(all_items),
            "high_priority": high_count,
        },
    }
