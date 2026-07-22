import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { type InboxData, type InboxGroup, type InboxItem } from '../services/api';

const PRIORITY_STYLES: Record<string, { dot: string; bg: string; border: string; text: string }> = {
  high: { dot: 'bg-red-500', bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-700' },
  medium: { dot: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700' },
  low: { dot: 'bg-gray-300', bg: 'bg-gray-50', border: 'border-gray-100', text: 'text-gray-500' },
};

function formatWeekday(dateStr: string): string {
  const d = new Date(dateStr);
  const weekdays = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  return weekdays[d.getDay()];
}

// ─── Group Header ─────────────────────────────────────────────────────────

function GroupHeader({ group, collapsed, onToggle }: {
  group: InboxGroup;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const urgentCount = group.items.filter(i => i.priority === 'high').length;

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-white shadow-sm transition-all duration-200 active:scale-[0.98]"
      style={{ backgroundColor: 'var(--tg-theme-button-color)' }}
    >
      <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg shrink-0">
        {group.icon}
      </div>
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{group.label}</span>
          <span className="text-[11px] font-medium bg-white/20 rounded-full px-2 py-0.5">
            {group.items.length}
          </span>
        </div>
        {urgentCount > 0 && !collapsed && (
          <span className="text-[10px] text-white/80">
            {urgentCount} {urgentCount === 1 ? 'требует' : 'требуют'} внимания
          </span>
        )}
      </div>
      <svg
        className={`w-4 h-4 text-white/70 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}

// ─── Lesson Card (rich lesson display) ───────────────────────────────────

function LessonCard({ item }: { item: InboxItem }) {
  const navigate = useNavigate();
  const color = item.color || '#6C5CE7';
  const isHigh = item.priority === 'high';
  const isCurrent = item.lesson_status === 'current';
  const isPast = item.lesson_status === 'past';

  return (
    <button
      onClick={() => navigate(item.action_url)}
      className="w-full text-left transition-all duration-150 active:scale-[0.97] group"
    >
      <div className="rounded-xl bg-white border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
        {/* Color accent bar */}
        <div className="h-1.5" style={{ backgroundColor: color }} />

        <div className="p-4">
          {/* Top row: time + time_until badge */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold" style={{ color }}>
                {item.lesson_time || ''}
              </span>
              <span className="text-sm font-semibold text-gray-800">
                {item.title.replace(item.lesson_time || '', '').trim() || item.title}
              </span>
            </div>

            {/* Time-until badge */}
            {item.time_until && (
              <div className={`
                shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold
                ${isCurrent
                  ? 'bg-green-100 text-green-700 animate-pulse'
                  : isPast
                    ? 'bg-gray-100 text-gray-400'
                    : 'bg-indigo-100 text-indigo-700'
                }
              `}>
                {isCurrent ? '🔴 ' : ''}{item.time_until}
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-[12px] text-gray-500 mb-3">
            {item.student_count !== undefined && (
              <span className="flex items-center gap-1">
                <span>👥</span>
                <span>{item.student_count} {item.student_count === 1 ? 'ученик' : 'учеников'}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              {isHigh ? '🔴' : isCurrent ? '🟡' : '🟢'}
              <span>{item.subtitle}</span>
            </span>
          </div>

          {/* Action button */}
          <div
            className={`
              w-full py-2 rounded-xl text-[12px] font-semibold text-center transition-all duration-150
              ${isHigh
                ? 'text-white shadow-sm'
                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
              }
              group-hover:opacity-90
            `}
            style={isHigh ? { backgroundColor: color } : {}}
          >
            {item.action_label}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="inline ml-1 -mt-0.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Inbox Card (generic for non-lesson groups) ──────────────────────────

function InboxCard({ item, onDismiss }: { item: InboxItem; onDismiss?: (id: string) => void }) {
  const navigate = useNavigate();
  const isHigh = item.priority === 'high';
  const styles = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.low;

  return (
    <div className={`rounded-xl p-3.5 ${styles.bg} border ${styles.border} hover:shadow-sm transition-shadow group`}>
      <div className="flex items-center gap-3">
        {/* Priority dot */}
        <div className="flex flex-col items-center shrink-0">
          <div className={`w-2.5 h-2.5 rounded-full ${styles.dot} ${isHigh ? 'animate-pulse' : ''}`} />
        </div>

        {/* Content — кликабельно */}
        <button onClick={() => navigate(item.action_url)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${styles.text} truncate`}>
              {item.title}
            </span>
            {isHigh && (
              <span className="text-[9px] font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded-full shrink-0">
                !
              </span>
            )}
          </div>
          {item.subtitle && (
            <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
              {item.subtitle}
            </p>
          )}
        </button>

        {/* Action chip + dismiss */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => navigate(item.action_url)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all
              ${isHigh
                ? 'bg-red-500 text-white shadow-sm shadow-red-500/30'
                : `${styles.bg} ${styles.text} border ${styles.border}`
              }
              hover:opacity-80`}
          >
            {item.action_label}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="inline ml-0.5 -mt-0.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          {onDismiss && (
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(item.id); }}
              className="p-1 rounded-full hover:bg-white/50 text-gray-400 hover:text-gray-600 transition-all text-[10px]"
              title="Убрать из списка"
            >
              ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function InboxPage() {
  const navigate = useNavigate();
  const [inbox, setInbox] = useState<InboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [localReminders, setLocalReminders] = useState<any[]>([]);
  const [dismissedCancelled, setDismissedCancelled] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadInbox();
    const interval = setInterval(loadInbox, 30000);
    return () => clearInterval(interval);
  }, []);

  // Загружаем отклонённые отменённые занятия из localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('edu_pulse_dismissed_cancelled') || '[]');
      setDismissedCancelled(new Set(stored));
    } catch {}
  }, []);

  // Загружаем локальные напоминания из localStorage
  useEffect(() => {
    const loadReminders = () => {
      try {
        const data = JSON.parse(localStorage.getItem('edu_pulse_reminders') || '[]');
        setLocalReminders(data);
      } catch {}
    };
    loadReminders();
    window.addEventListener('storage', loadReminders);
    return () => window.removeEventListener('storage', loadReminders);
  }, []);

  // ── Reschedule modal state ───────────────────────────────────────────
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleData, setRescheduleData] = useState<{
    reminderId: string;
    lessonId: string;
    courseId: string;
    title: string;
    originalDate: string;
    originalTime: string;
  } | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [savingReschedule, setSavingReschedule] = useState(false);
  const [rescheduleConflict, setRescheduleConflict] = useState<string | null>(null);

  // Load all lessons for conflict detection
  const [allLessons, setAllLessons] = useState<any[]>([]);

  useEffect(() => {
    // Pre-load lessons for conflict detection
    api.getLessons().then(d => setAllLessons(d.lessons || [])).catch(() => {});
  }, []);

  /** Проверка пересечения двух временных интервалов [start,end). */
  const timesOverlap = (s1: string, e1: string, s2: string, e2: string): boolean => {
    if (!s1 || !s2) return false;
    if (!e1 || !e2) return s1 === s2;
    return s1 < e2 && e1 > s2;
  };

  // Check for conflicts when date/time changes
  const checkConflict = (date: string, time: string) => {
    if (!date || !time || !rescheduleData) {
      setRescheduleConflict(null);
      return;
    }
    // Check all non-cancelled lessons that INTERSECT with this time slot
    const conflict = allLessons.find(l => {
      if (l.date !== date) return false;
      if (l.status === 'cancelled') return false;
      if (l.id === rescheduleData.lessonId) return false;
      const lStart = l.start_time || l.time || '';
      const lEnd = l.end_time || '';
      return timesOverlap(time, '', lStart, lEnd);
    });
    if (conflict) {
      const cStart = conflict.start_time || conflict.time || '';
      const cEnd = conflict.end_time || '';
      const conflictTime = cStart && cEnd ? `${cStart}—${cEnd}` : cStart;
      setRescheduleConflict(`⚠️ «${conflict.title || ''}» уже в этот промежуток (${conflictTime})`);
    } else {
      setRescheduleConflict(null);
    }
  };

  const openRescheduleModal = (reminder: any) => {
    setRescheduleData({
      reminderId: reminder.id,
      lessonId: reminder.lesson_id || '',
      courseId: reminder.course_id || '',
      title: reminder.title || 'Занятие',
      originalDate: reminder.original_date || '',
      originalTime: reminder.time || '',
    });
    // Default: today, same time as original
    const d = new Date();
    setRescheduleDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    setRescheduleTime(reminder.time || '');
    setRescheduleConflict(null);
    setShowRescheduleModal(true);
  };

  const handleRescheduleConfirm = async () => {
    if (!rescheduleData || !rescheduleDate) return;
    setSavingReschedule(true);
    try {
      // 1. Create a new make-up lesson
      const newLesson = await api.createLesson({
        course_id: rescheduleData.courseId || undefined,
        date: rescheduleDate,
        time: rescheduleTime || undefined,
        title: `Отработка: ${rescheduleData.title}`,
        lesson_type: 'make_up',
        status: 'scheduled',
        note: `Отработка отменённого занятия от ${rescheduleData.originalDate}`,
      });

      // 2. Update the original cancelled lesson's rescheduled_to
      if (rescheduleData.lessonId) {
        try {
          await api.updateLesson(rescheduleData.lessonId, {
            rescheduled_to: newLesson.id,
          });
        } catch (e) {
          console.error('Failed to update original lesson:', e);
        }
      }

      // 3. Dismiss reminder
      dismissReminder(rescheduleData.reminderId);
      dismissCancelledLesson(`cancelled_${rescheduleData.lessonId}`);

      setShowRescheduleModal(false);
      setRescheduleData(null);
    } catch (e) {
      console.error('Failed to reschedule:', e);
      alert('Ошибка при создании отработки');
    } finally {
      setSavingReschedule(false);
    }
  };

  // Удалить напоминание
  const dismissReminder = (id: string) => {
    const updated = localReminders.filter(r => r.id !== id);
    setLocalReminders(updated);
    localStorage.setItem('edu_pulse_reminders', JSON.stringify(updated));
  };

  // Отклонить отменённое занятие (убрать из inbox)
  const dismissCancelledLesson = (id: string) => {
    const updated = new Set(dismissedCancelled);
    updated.add(id);
    setDismissedCancelled(updated);
    localStorage.setItem('edu_pulse_dismissed_cancelled', JSON.stringify([...updated]));
  };

  const loadInbox = async () => {
    try {
      setLoading(true);
      const data = await api.getInbox();
      setInbox(data);
      setError(null);
    } catch (e) {
      console.error('Failed to load inbox:', e);
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Loading ──────────────────────────────────────────────────────────
  if (loading && !inbox) {
    return (
      <div className="p-4 space-y-4 animate-fade-in">
        <div className="skeleton h-8 w-40 mb-1" />
        <div className="skeleton h-5 w-56 mb-4" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton h-28 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error && !inbox) {
    return (
      <div className="p-4 animate-fade-in">
        <div className="tg-card flex flex-col items-center py-8">
          <span className="text-4xl mb-3">😔</span>
          <p className="text-sm text-[var(--tg-theme-hint-color)] mb-4">{error}</p>
          <button onClick={loadInbox} className="tg-button text-sm">
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (!inbox) return null;

  const totalHigh = inbox.stats.high_priority;

  return (
    <div className="p-4 space-y-3 animate-fade-in pb-6">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tg-theme-text-color)]">
            📥 Сегодня
          </h1>
          <p className="text-xs text-[var(--tg-theme-hint-color)] mt-0.5">
            {formatWeekday(inbox.date)}, {inbox.date}
            {totalHigh > 0 && (
              <span className="text-red-500 font-medium ml-1">
                · {totalHigh} {totalHigh === 1 ? 'требует' : 'требуют'} внимания
              </span>
            )}
          </p>
        </div>
        <button
          onClick={loadInbox}
          className="w-9 h-9 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] flex items-center justify-center hover:opacity-70 transition-opacity text-sm"
          title="Обновить"
        >
          🔄
        </button>
      </div>

      {/* ── Quick summary bar ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-[11px] text-[var(--tg-theme-hint-color)] bg-[var(--tg-theme-secondary-bg-color)] rounded-xl px-3 py-2">
        {inbox.groups.map((g, i) => (
          <span key={g.key} className="flex items-center gap-1">
            <span>{g.icon}</span>
            <span className="font-medium">{g.items.length}</span>
            {i < inbox.groups.length - 1 && <span className="mx-0.5 text-[var(--tg-theme-section-separator-color)]">|</span>}
          </span>
        ))}
        <span className="ml-auto text-[10px] opacity-60">{inbox.stats.total} всего</span>
      </div>

      {/* ── Local reminders (cancelled lessons marked later) ────────── */}
      {localReminders.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 px-1">
            <span className="text-sm">⏰</span>
            <span className="text-xs font-semibold text-purple-700">
              Напомнить о переносе
            </span>
            <span className="text-[10px] bg-purple-100 text-purple-600 rounded-full px-2 py-0.5 font-medium">
              {localReminders.length}
            </span>
          </div>
          {localReminders.map((reminder) => (
            <div key={reminder.id}
              className="rounded-xl border-2 border-purple-200 bg-purple-50 p-3.5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">❌</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-purple-800 truncate">
                      {reminder.title}
                    </span>
                    <span className="text-[9px] font-bold text-purple-500 bg-purple-100 px-1.5 py-0.5 rounded-full shrink-0">
                      ВАЖНО
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-600 mt-0.5">
                    Отменённое занятие от {reminder.original_date}. Нужно перенести!
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => openRescheduleModal(reminder)}
                      className="text-[11px] font-medium text-white bg-purple-500 rounded-lg px-3 py-1.5 hover:bg-purple-600 transition-colors"
                    >
                      Запланировать
                    </button>
                    <button
                      onClick={() => dismissReminder(reminder.id)}
                      className="text-[11px] text-purple-400 hover:text-purple-600 transition-colors px-2 py-1"
                    >
                      ✓ Готово
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Groups ───────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {inbox.groups.map((group) => {
          const isCollapsed = collapsedGroups[group.key] ?? false;
          const isLessonGroup = group.key === 'lessons';

          // Pre-filter dismissed cancelled items
          const displayItems = group.key === 'cancelled'
            ? group.items.filter(i => !dismissedCancelled.has(i.id))
            : group.items;

          const hasFilteredNonLessonItems = group.key === 'cancelled' && displayItems.length === 0 && group.items.length > 0;

          return (
            <div key={group.key} className="space-y-1.5">
              <GroupHeader
                group={{ ...group, items: displayItems }}
                collapsed={isCollapsed}
                onToggle={() => toggleGroup(group.key)}
              />

              {!isCollapsed && (
                <div className="space-y-1.5 pl-2 animate-slide-up">
                  {displayItems.length === 0 && isLessonGroup ? (
                    <div className="rounded-xl bg-white border border-dashed border-gray-200 p-6 text-center">
                      <div className="text-3xl mb-2">📅</div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Сегодня занятий нет</p>
                      <p className="text-[11px] text-gray-400">Следующее занятие появится здесь автоматически.</p>
                    </div>
                  ) : (
                    displayItems.map((item) => (
                      isLessonGroup
                        ? <LessonCard key={item.id} item={item} />
                        : <InboxCard key={item.id} item={item}
                            onDismiss={group.key === 'cancelled' ? dismissCancelledLesson : undefined}
                          />
                    ))
                  )}
                  {/* Если после фильтрации осталось 0 — показываем "всё готово" */}
                  {hasFilteredNonLessonItems && (
                    <div className="rounded-xl bg-green-50 border border-green-100 p-3 text-center">
                      <p className="text-xs text-green-700">✅ Все отменённые занятия обработаны</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {inbox.groups.length === 0 && (
        <div className="tg-card flex flex-col items-center py-10 text-center">
          <span className="text-5xl mb-4">🎉</span>
          <p className="text-base font-semibold text-[var(--tg-theme-text-color)] mb-1">
            Всё отлично!
          </p>
          <p className="text-sm text-[var(--tg-theme-hint-color)]">
            Сегодня нет задач, требующих внимания.
            Можно отдохнуть 🧘
          </p>
        </div>
      )}

      {/* ── Auto-refresh hint ────────────────────────────────────────── */}
      <p className="text-center text-[9px] text-[var(--tg-theme-hint-color)] pt-1">
        Данные обновляются автоматически · {inbox.stats.total} сигналов
      </p>

      {/* ── Reschedule Modal ──────────────────────────────────────────── */}
      {showRescheduleModal && rescheduleData && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => { setShowRescheduleModal(false); setRescheduleData(null); }}>
          <div className="w-full max-w-sm bg-[var(--tg-theme-bg-color)] rounded-3xl p-5 shadow-2xl animate-slide-up"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">📅 Запланировать отработку</h3>
              <button onClick={() => { setShowRescheduleModal(false); setRescheduleData(null); }}
                className="p-1 text-[var(--tg-theme-hint-color)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="mb-3 p-3 rounded-xl bg-purple-50 border border-purple-100">
              <p className="text-xs font-semibold text-purple-800">❌ {rescheduleData.title}</p>
              <p className="text-[10px] text-purple-600 mt-0.5">
                Отменено {rescheduleData.originalDate}
                {rescheduleData.originalTime && ` в ${rescheduleData.originalTime}`}
              </p>
            </div>

            {/* Date picker */}
            <div className="mb-3">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1 block">📆 Дата отработки *</label>
              <input type="date" value={rescheduleDate}
                onChange={e => {
                  setRescheduleDate(e.target.value);
                  checkConflict(e.target.value, rescheduleTime);
                }}
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
            </div>

            {/* Time picker */}
            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1 block">⏰ Время</label>
              <input type="time" value={rescheduleTime}
                onChange={e => {
                  setRescheduleTime(e.target.value);
                  checkConflict(rescheduleDate, e.target.value);
                }}
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
            </div>

            {/* Conflict warning */}
            {rescheduleConflict && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <span>⚠️</span>
                <span>{rescheduleConflict}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setShowRescheduleModal(false); setRescheduleData(null); }}
                className="tg-button-secondary flex-1 text-sm">Отмена</button>
              <button onClick={handleRescheduleConfirm}
                disabled={savingReschedule || !rescheduleDate || !!rescheduleConflict}
                className="tg-button flex-1 text-sm disabled:opacity-50">
                {savingReschedule ? '⏳...' : '✅ Запланировать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
