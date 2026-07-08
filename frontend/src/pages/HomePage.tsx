import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { type DashboardData } from '../services/api';

function formatTimeAgo(time: string): string {
  const now = new Date();
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return '';
  const courseTime = new Date();
  courseTime.setHours(h, m, 0, 0);
  const diffMs = courseTime.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin <= 0) return 'Сейчас';
  if (diffMin < 60) return `Через ${diffMin} мин`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return `Через ${hours} ч ${mins} мин`;
}

function formatWeekday(dateStr: string): string {
  const d = new Date(dateStr);
  const weekdays = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  return weekdays[d.getDay()];
}

export default function HomePage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await api.getDashboard();
      setDashboard(data);
      setError(null);
    } catch (e) {
      console.error('Failed to load dashboard:', e);
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────
  if (loading && !dashboard) {
    return (
      <div className="p-4 space-y-4 animate-fade-in">
        <div className="skeleton h-8 w-40 mb-1" />
        <div className="skeleton h-5 w-56 mb-4" />
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-16 rounded-2xl" />)}
        </div>
        {[1, 2].map(i => (
          <div key={i} className="skeleton h-28 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="p-4 space-y-4 animate-fade-in">
        <div className="tg-card flex flex-col items-center py-8">
          <span className="text-4xl mb-3">😔</span>
          <p className="text-sm text-[var(--tg-theme-hint-color)] mb-4">{error}</p>
          <button onClick={loadDashboard} className="tg-button text-sm">
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  const { today: todayData } = dashboard;
  const totalPaymentAlerts = todayData.payment_alerts?.length || 0;

  return (
    <div className="p-4 space-y-4 animate-fade-in pb-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--tg-theme-text-color)]">Сегодня</h1>
        <p className="text-xs text-[var(--tg-theme-hint-color)] mt-0.5">
          {formatWeekday(todayData.date)}, {todayData.date}
          {todayData.total_lessons > 0 && ` · ${todayData.total_lessons} ${todayData.total_lessons === 1 ? 'занятие' : 'занятий'}`}
        </p>
      </div>

      {/* ── Compact stats row — всё кликабельно ─────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        <button onClick={() => navigate('/admin/courses')}
          className="bg-[var(--tg-theme-section-bg-color)] rounded-2xl p-2.5 text-center shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer">
          <span className="text-lg font-bold text-[var(--tg-theme-text-color)]">{todayData.total_lessons}</span>
          <p className="text-[9px] text-[var(--tg-theme-hint-color)] mt-0.5">📚 Занятия</p>
        </button>
        <button onClick={() => navigate('/admin/students')}
          className="bg-[var(--tg-theme-section-bg-color)] rounded-2xl p-2.5 text-center shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer">
          <span className="text-lg font-bold text-[var(--tg-theme-text-color)]">{todayData.total_students}</span>
          <p className="text-[9px] text-[var(--tg-theme-hint-color)] mt-0.5">👨‍🎓 Ученики</p>
        </button>
        <button
          onClick={() => todayData.lessons.length > 0 && navigate(`/lesson/${todayData.lessons[0].id}`)}
          className="bg-green-50 rounded-2xl p-2.5 text-center border border-green-100 hover:shadow-md transition-all active:scale-95 cursor-pointer">
          <span className="text-lg font-bold text-green-600">{todayData.present}/{todayData.total_students || 0}</span>
          <p className="text-[9px] text-green-500 mt-0.5">✅ Пришли</p>
        </button>
        <button onClick={() => navigate('/admin/payments')}
          className={`rounded-2xl p-2.5 text-center border hover:shadow-md transition-all active:scale-95 cursor-pointer ${
            totalPaymentAlerts > 0 ? 'bg-amber-50 border-amber-100' : 'bg-[var(--tg-theme-section-bg-color)] border-transparent'
          }`}>
          <span className={`text-lg font-bold ${totalPaymentAlerts > 0 ? 'text-amber-600' : 'text-[var(--tg-theme-text-color)]'}`}>
            {totalPaymentAlerts}
          </span>
          <p className="text-[9px] text-amber-500 mt-0.5">💰 Оплаты</p>
        </button>
      </div>

      {/* ── Payment alerts ─────────────────────────────────────────────── */}
      {totalPaymentAlerts > 0 && (
        <button
          onClick={() => navigate('/admin/payments')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 hover:shadow-sm transition-all active:scale-[0.98]"
        >
          <span className="text-xl">💰</span>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-amber-800">Ожидают оплаты</p>
            <p className="text-xs text-amber-600">
              {todayData.pending_payments > 0 && `${todayData.pending_payments} ожидают`}
              {todayData.pending_payments > 0 && todayData.overdue_payments > 0 && ' · '}
              {todayData.overdue_payments > 0 && `${todayData.overdue_payments} просрочено`}
            </p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* ── Linear Schedule ────────────────────────────────────────────── */}
      {todayData.lessons.length === 0 ? (
        <div className="tg-card flex flex-col items-center py-10 text-center">
          <span className="text-5xl mb-4">🎉</span>
          <p className="text-base font-semibold text-[var(--tg-theme-text-color)] mb-1">Сегодня занятий нет</p>
          <p className="text-sm text-[var(--tg-theme-hint-color)]">Можно отдохнуть или подготовиться к следующему уроку</p>
        </div>
      ) : (
        <div className="space-y-2">
          {todayData.lessons.map((lesson, idx) => {
            const stats = lesson.attendance_stats;
            const marked = stats.total_marked;
            const total = stats.total_marked + stats.unmarked;
            const lessonUnmarked = lesson.unmarked_students || [];
            const timeStr = formatTimeAgo(lesson.time || '');
            const allMarked = stats.unmarked === 0 && marked > 0;
            const isCancelled = lesson.status === 'cancelled';

            return (
              <div key={lesson.id} className={`animate-slide-up ${isCancelled ? 'opacity-60' : ''}`} style={{ animationDelay: `${idx * 50}ms` }}>
                <button
                  onClick={() => navigate(`/lesson/${lesson.id}`)}
                  className={`w-full tg-card text-left transition-all duration-200 active:scale-[0.98] ${
                    !allMarked && stats.unmarked > 0 ? 'ring-1 ring-amber-200' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Time */}
                    <div className="flex flex-col items-center min-w-[52px] pt-0.5">
                      <span className="text-xl font-bold text-[var(--tg-theme-text-color)] leading-tight">
                        {lesson.time || '—'}
                      </span>
                      {timeStr && (
                        <span className={`text-[10px] font-medium mt-0.5 ${timeStr === 'Сейчас' ? 'text-green-500' : 'text-[var(--tg-theme-button-color)]'}`}>
                          {timeStr}
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: lesson.color || '#6C5CE7' }} />
                        <span className="text-base font-semibold text-[var(--tg-theme-text-color)] truncate">{lesson.title}</span>
                        {isCancelled && <span className="text-[10px] text-red-500 font-medium shrink-0">❌</span>}
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-[var(--tg-theme-hint-color)]">
                          {lesson.student_count} {lesson.student_count === 1 ? 'ученик' : 'учеников'}
                        </span>
                        <span className="text-[var(--tg-theme-hint-color)]">·</span>
                        {allMarked ? (
                          <span className="text-xs text-green-600 font-medium">✅ {marked}/{total} отмечены</span>
                        ) : (
                          <span className={`text-xs font-medium ${stats.unmarked > 0 ? 'text-amber-600' : 'text-[var(--tg-theme-hint-color)]'}`}>
                            {marked}/{total} отмечены
                          </span>
                        )}
                      </div>

                      {/* Location */}
                      {(lesson.location || lesson.location_link) && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px]">📍</span>
                          {lesson.location_link ? (
                            <a href={lesson.location_link} target="_blank" rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] text-[var(--tg-theme-button-color)] underline underline-offset-2 hover:opacity-80 transition-opacity truncate">
                              {lesson.location || 'Открыть карту'}
                            </a>
                          ) : (
                            <span className="text-[11px] text-[var(--tg-theme-hint-color)] truncate">{lesson.location}</span>
                          )}
                        </div>
                      )}

                      {/* Unmarked chips */}
                      {lessonUnmarked.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2.5 pt-2 border-t border-[var(--tg-theme-section-separator-color)]">
                          {lessonUnmarked.slice(0, 4).map(s => (
                            <span key={s.id}
                              onClick={(e) => { e.stopPropagation(); navigate(`/student/${s.id}`); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); navigate(`/student/${s.id}`); } }}
                              role="button" tabIndex={0}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-100 text-[10px] text-amber-700 font-medium hover:bg-amber-100 transition-colors active:scale-95 cursor-pointer">
                              {s.first_name}
                            </span>
                          ))}
                          {lessonUnmarked.length > 4 && (
                            <span className="text-[10px] text-amber-500 font-medium px-1">+{lessonUnmarked.length - 4}</span>
                          )}
                        </div>
                      )}

                      {/* All marked */}
                      {allMarked && (
                        <div className="mt-2.5 pt-2 border-t border-[var(--tg-theme-section-separator-color)]">
                          <span className="text-xs text-green-600 font-medium">✅ Все отмечены</span>
                        </div>
                      )}
                    </div>

                    {/* Action */}
                    <div className="shrink-0 flex flex-col items-center">
                      {isCancelled ? (
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                          <span className="text-xs text-red-500 font-bold">❌</span>
                        </div>
                      ) : allMarked ? (
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                        </div>
                      ) : stats.unmarked > 0 ? (
                        <div className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-semibold shadow-sm shadow-amber-500/30">
                          +{stats.unmarked}
                        </div>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--tg-theme-hint-color)]">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Auto-refresh hint ──────────────────────────────────────────── */}
      <p className="text-center text-[9px] text-[var(--tg-theme-hint-color)] pt-1">Данные обновляются автоматически</p>
    </div>
  );
}
