#!/usr/bin/env python3
"""
Очистка group.student_ids во всех группах.

Запуск:
    python scripts/clear_group_students.py

Что делает:
    Проходит по всем активным группам и устанавливает student_ids = ""
    Это не удаляет группы и не трогает другие данные.
"""

import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def main():
    from backend.app.services.group_service import list_groups, update_group

    logger.info("=" * 60)
    logger.info("Загрузка групп...")
    logger.info("=" * 60)

    groups = list_groups(active_only=True)
    logger.info(f"Найдено активных групп: {len(groups)}")

    cleared_count = 0
    already_empty = 0

    for g in groups:
        gid = g.get("id", "")
        name = g.get("name", "")
        student_ids_str = g.get("student_ids", "")

        if not student_ids_str:
            already_empty += 1
            logger.info(f"  ℹ  {name} (id={gid}) — уже пустая")
            continue

        student_ids_list = [s.strip() for s in student_ids_str.split(",") if s.strip()]
        logger.info(f"  → {name} (id={gid}): {len(student_ids_list)} учеников — очищаю...")

        success = update_group(gid, {"student_ids": ""})
        if success:
            cleared_count += 1
            logger.info(f"    ✅ Очищено")
        else:
            logger.error(f"    ❌ Ошибка при очистке")

    logger.info("=" * 60)
    logger.info(f"Итого: очищено {cleared_count} групп, {already_empty} уже были пустыми")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
