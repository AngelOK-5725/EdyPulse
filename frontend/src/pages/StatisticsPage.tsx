import { useEffect, useState } from 'react';
import api, { type DashboardData } from '../services/api';

export default function StatisticsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const result = await api.getDashboard();
      setData(result);
      setError(null);
    } catch (e) {
      console.error('Failed to load dashboard:', e);
      setError('Не удалось загрузить статистику');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4 animate-fade-in">
        <div className="skeleton h-6 w-40 mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-40 w-full rounded-2xl" />
        <div className="skeleton h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-4 animate-fade-in">
        <div className="tg-card flex flex-col items-center py-8 text-center">
          <span className="text-4xl mb-3">📊</span>
          <p className="text-sm text-[var(--tg-theme-hint-color)] mb-4">{error}</p>
          <button onClick={loadDashboard} className="tg-button text-sm">
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { today, summary } = data;

  // ── Attendance rate calculations ──────────────────────────────────────
  const totalMarked = today.present + today.late + today.absent;
  const attendanceRate = totalMarked > 0
    ? Math.round((today.present / totalMarked) * 100)
    : 0;

  // ── Payment stats ─────────────────────────────────────────────────────
  const totalPayments = summary.total_payments;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-[var(--tg-theme-text-color)]">
          Статистика
        </h2>
        <span className="text-xs text-[var(--tg-theme-hint-color)]">
          {today.date}
        </span>
      </div>

      {/* ── Today Overview ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--tg-theme-section-bg-color)] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">📚</span>
            <span className="text-xs text-[var(--tg-theme-hint-color)]">Занятий сегодня</span>
          </div>
          <span className="text-2xl font-bold text-[var(--tg-theme-text-color)]">
            {today.total_lessons}
          </span>
        </div>
        <div className="bg-[var(--tg-theme-section-bg-color)] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">👨‍🎓</span>
            <span className="text-xs text-[var(--tg-theme-hint-color)]">Учеников сегодня</span>
          </div>
          <span className="text-2xl font-bold text-[var(--tg-theme-text-color)]">
            {today.total_students}
          </span>
        </div>
        <div className="bg-[var(--tg-theme-section-bg-color)] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">✅</span>
            <span className="text-xs text-[var(--tg-theme-hint-color)]">Присутствуют</span>
          </div>
          <span className={`text-2xl font-bold ${today.present > 0 ? 'text-green-500' : 'text-[var(--tg-theme-text-color)]'}`}>
            {today.present}
          </span>
        </div>
        <div className="bg-[var(--tg-theme-section-bg-color)] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">❌</span>
            <span className="text-xs text-[var(--tg-theme-hint-color)]">Отсутствуют</span>
          </div>
          <span className={`text-2xl font-bold ${today.absent > 0 ? 'text-red-500' : 'text-[var(--tg-theme-text-color)]'}`}>
            {today.absent}
          </span>
        </div>
      </div>

      {/* ── Attendance Stats ───────────────────────────────────────────── */}
      <div className="tg-card">
        <h3 className="text-base font-semibold text-[var(--tg-theme-text-color)] mb-3 flex items-center gap-2">
          <span>📊</span> Посещаемость
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-[var(--tg-theme-hint-color)]">Сегодня отмечено</span>
            <p className="text-lg font-bold text-[var(--tg-theme-text-color)]">
              {totalMarked} / {today.total_students}
            </p>
          </div>
          <div>
            <span className="text-xs text-[var(--tg-theme-hint-color)]">% посещения</span>
            <p className={`text-lg font-bold ${attendanceRate >= 85 ? 'text-green-500' : attendanceRate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
              {attendanceRate}%
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-green-500 transition-all duration-700"
            style={{ width: `${today.present > 0 ? (today.present / totalMarked) * 100 : 0}%` }}
          />
          <div
            className="h-full bg-amber-500 transition-all duration-700"
            style={{ width: `${today.late > 0 ? (today.late / totalMarked) * 100 : 0}%` }}
          />
          <div
            className="h-full bg-red-500 transition-all duration-700"
            style={{ width: `${today.absent > 0 ? (today.absent / totalMarked) * 100 : 0}%` }}
          />
        </div>
        {today.unmarked > 0 && (
          <p className="text-xs text-[var(--tg-theme-hint-color)] mt-2">
            ❓ {today.unmarked} учеников ещё не отмечены
          </p>
        )}
      </div>

      {/* ── Payments Stats ─────────────────────────────────────────────── */}
      <div className="tg-card">
        <h3 className="text-base font-semibold text-[var(--tg-theme-text-color)] mb-3 flex items-center gap-2">
          <span>💰</span> Оплаты
        </h3>
        <div className="space-y-3">
          {totalPayments === 0 ? (
            <p className="text-sm text-[var(--tg-theme-hint-color)] text-center py-4">
              Нет записей об оплатах
            </p>
          ) : (
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-[var(--tg-theme-text-color)]">Всего платежей</span>
              <span className="text-sm font-semibold text-[var(--tg-theme-text-color)]">{totalPayments}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Today's Lessons Breakdown ──────────────────────────────────── */}
      <div className="tg-card">
        <h3 className="text-base font-semibold text-[var(--tg-theme-text-color)] mb-3 flex items-center gap-2">
          <span>📚</span> Занятия сегодня
        </h3>
        <div className="space-y-3">
          {today.lessons.length === 0 ? (
            <p className="text-sm text-[var(--tg-theme-hint-color)] text-center py-4">
              Сегодня нет занятий
            </p>
          ) : (
            today.lessons.map(lesson => {
              const stats = lesson.attendance_stats;
              const lessonRate = stats.total_marked > 0
                ? Math.round((stats.present / stats.total_marked) * 100)
                : 0;

              return (
                <div key={lesson.id} className="flex items-center p-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)]">
                  <div className="w-2 h-10 rounded-full shrink-0 mr-3" style={{ backgroundColor: lesson.color || '#6C5CE7' }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-[var(--tg-theme-text-color)] block truncate">
                      {lesson.title}
                    </span>
                    <div className="flex gap-4 mt-1">
                      <span className="text-xs text-[var(--tg-theme-hint-color)]">
                        {lesson.student_count} уч.
                      </span>
                      <span className="text-xs text-[var(--tg-theme-hint-color)]">
                        {stats.total_marked > 0 ? `${lessonRate}% посещ.` : 'нет отметок'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="text-xs font-semibold text-green-500 block">
                      ✅ {stats.present}
                    </span>
                    {stats.absent > 0 && (
                      <span className="text-xs font-semibold text-red-500">
                        ❌ {stats.absent}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Overall Summary ────────────────────────────────────────────── */}
      <div className="tg-card">
        <h3 className="text-base font-semibold text-[var(--tg-theme-text-color)] mb-3 flex items-center gap-2">
          <span>📈</span> Общая сводка
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--tg-theme-hint-color)]">Всего курсов</span>
            <span className="text-sm font-semibold text-[var(--tg-theme-text-color)]">{summary.total_courses}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--tg-theme-section-separator-color)] pt-2">
            <span className="text-sm text-[var(--tg-theme-hint-color)]">Всего учеников</span>
            <span className="text-sm font-semibold text-[var(--tg-theme-text-color)]">{summary.total_students}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
