import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { type Course } from '../services/api';

// ─── Вспомогательные типы ──────────────────────────────────────────────────

interface LessonItem {
  id: string;
  course_id: string;
  date: string;
  time: string;
  title: string;
  status: string;
  homework: string;
  location: string;
  location_link: string;
  note: string;
  student_count: number;
  attendance_stats: {
    present: number;
    late: number;
    absent: number;
    trial: number;
    unmarked: number;
    total_marked: number;
  };
  unmarked_students: Array<{ id: string; first_name: string; last_name: string }>;
  color?: string;
}

interface CreateLessonData {
  course_id: string;
  date: string;
  time: string;
  title: string;
  location: string;
  location_link: string;
}

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Пн — начало недели
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDateDisplay(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (formatDate(date) === formatDate(today)) return 'Сегодня';
  if (formatDate(date) === formatDate(tomorrow)) return 'Завтра';
  if (formatDate(date) === formatDate(yesterday)) return 'Вчера';

  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function getWeekDays(date: Date): Date[] {
  const start = getWeekStart(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getTodayString(): string {
  return formatDate(new Date());
}

const STATUS_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  scheduled: { label: 'Запланировано', icon: '✅', color: 'text-green-600 bg-green-50 border-green-200' },
  completed: { label: 'Проведено', icon: '✅', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  cancelled: { label: 'Отменено', icon: '❌', color: 'text-red-600 bg-red-50 border-red-200' },
  rescheduled: { label: 'Перенесено', icon: '🔄', color: 'text-amber-600 bg-amber-50 border-amber-200' },
};

// ─── Компонент ─────────────────────────────────────────────────────────────

export default function LessonsPage() {
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const isAdmin = permissions.canManageUsers; // admin+
  const isTeacher = permissions.canEditStudents; // user+

  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Фильтры ──────────────────────────────────────────────────────────────
  const [filterCourseId, setFilterCourseId] = useState<string>('all');
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));

  // ── Create/Edit form state ───────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LessonItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateLessonData>({
    course_id: '',
    date: getTodayString(),
    time: '',
    title: '',
    location: '',
    location_link: '',
  });

  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, [weekStart]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load courses for the filter dropdown
      const coursesData = await api.getCourses();
      setCourses(coursesData.courses);

      // Load lessons for the selected week range
      // We load lessons from Mon to Sun
      const weekDays = getWeekDays(weekStart);
      const startDate = formatDate(weekDays[0]);
      const endDate = formatDate(weekDays[6]);

      // API doesn't support date range, so we load all active lessons and filter client-side
      const lessonsData = await api.getLessons();
      const allLessons: LessonItem[] = (lessonsData.lessons || []).map((l: any) => ({
        ...l,
        student_count: l.student_count || 0,
        attendance_stats: l.attendance_stats || { present: 0, late: 0, absent: 0, trial: 0, unmarked: 0, total_marked: 0 },
        unmarked_students: l.unmarked_students || [],
        color: l.color || '#6C5CE7',
      }));

      // Filter to the current week
      const weekLessons = allLessons.filter(l => {
        const d = l.date;
        return d >= startDate && d <= endDate;
      });

      setLessons(weekLessons);
    } catch (e) {
      console.error('LessonsPage: Failed to load data:', e);
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  // ── Week navigation ──────────────────────────────────────────────────────
  const goPrevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const goNextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const goCurrentWeek = () => {
    setWeekStart(getWeekStart(new Date()));
  };

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const isCurrentWeek = formatDate(weekStart) === formatDate(getWeekStart(new Date()));

  // ── Get course title by ID ───────────────────────────────────────────────
  const getCourseTitle = (courseId: string): string => {
    const course = courses.find(c => c.id === courseId);
    return course?.title || 'Курс удалён';
  };

  const getCourseColor = (courseId: string): string => {
    const course = courses.find(c => c.id === courseId);
    return course?.color || '#6C5CE7';
  };

  // ── Search & filters ─────────────────────────────────────────────────────
  const filteredLessons = useMemo(() => {
    let result = lessons;

    // Filter by course
    if (filterCourseId !== 'all') {
      result = result.filter(l => l.course_id === filterCourseId);
    }

    // Search by title/course title
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(l =>
        l.title.toLowerCase().includes(q) ||
        getCourseTitle(l.course_id).toLowerCase().includes(q) ||
        (l.location && l.location.toLowerCase().includes(q))
      );
    }

    // Sort by date then time
    return result.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.time || '00:00').localeCompare(b.time || '00:00');
    });
  }, [lessons, filterCourseId, searchQuery]);

  // ── Group by day ─────────────────────────────────────────────────────────
  const lessonsByDate = useMemo(() => {
    const grouped: Record<string, LessonItem[]> = {};
    for (const l of filteredLessons) {
      if (!grouped[l.date]) grouped[l.date] = [];
      grouped[l.date].push(l);
    }
    return grouped;
  }, [filteredLessons]);

  // ── Form handlers ────────────────────────────────────────────────────────
  const openCreateForm = () => {
    setEditingLesson(null);
    setForm({
      course_id: courses.length > 0 ? courses[0].id : '',
      date: getTodayString(),
      time: '',
      title: '',
      location: '',
      location_link: '',
    });
    setShowForm(true);
  };

  const openEditForm = (lesson: LessonItem) => {
    setEditingLesson(lesson);
    setForm({
      course_id: lesson.course_id,
      date: lesson.date,
      time: lesson.time || '',
      title: lesson.title,
      location: lesson.location || '',
      location_link: lesson.location_link || '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingLesson(null);
  };

  // ── Create ───────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.course_id || !form.date) return;
    setSaving(true);
    try {
      await api.createLesson({
        course_id: form.course_id,
        date: form.date,
        time: form.time || undefined,
        title: form.title || undefined,
        location: form.location || undefined,
        location_link: form.location_link || undefined,
      });
      closeForm();
      await loadData();
    } catch (e) {
      console.error('Failed to create lesson:', e);
      alert('Ошибка при создании занятия');
    } finally {
      setSaving(false);
    }
  };

  // ── Update ───────────────────────────────────────────────────────────────
  const handleUpdate = async () => {
    if (!editingLesson || !form.course_id || !form.date) return;
    setSaving(true);
    try {
      await api.updateLesson(editingLesson.id, {
        course_id: form.course_id,
        date: form.date,
        time: form.time || undefined,
        title: form.title || undefined,
        location: form.location || undefined,
        location_link: form.location_link || undefined,
      });
      closeForm();
      await loadData();
    } catch (e) {
      console.error('Failed to update lesson:', e);
      alert('Ошибка при сохранении занятия');
    } finally {
      setSaving(false);
    }
  };

  // ── Archive (soft-delete) ────────────────────────────────────────────────
  const handleArchive = async (lesson: LessonItem) => {
    if (!window.confirm(`Архивировать занятие «${lesson.title}» от ${lesson.date}?`)) return;
    try {
      await api.deleteLesson(lesson.id);
      await loadData();
    } catch (e) {
      console.error('Failed to archive lesson:', e);
      alert('Ошибка при архивировании занятия');
    }
  };

  // ── Status display ───────────────────────────────────────────────────────
  const getStatusInfo = (status: string) => {
    return STATUS_LABELS[status] || { label: status, icon: '❓', color: 'text-gray-600 bg-gray-50 border-gray-200' };
  };

  const getUnmarkedCount = (lesson: LessonItem): number => {
    return lesson.attendance_stats?.unmarked ?? 0;
  };

  const getTotalMarked = (lesson: LessonItem): number => {
    return lesson.attendance_stats?.total_marked ?? 0;
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 space-y-4 animate-fade-in">
        <div className="skeleton h-8 w-32 mb-1" />
        <div className="skeleton h-10 w-full rounded-2xl mb-2" />
        <div className="flex gap-2 mb-2">
          {[1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} className="skeleton h-10 flex-1 rounded-xl" />)}
        </div>
        <div className="skeleton h-16 w-full rounded-2xl" />
        <div className="skeleton h-16 w-full rounded-2xl" />
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="p-4 animate-fade-in min-h-full flex flex-col items-center justify-center">
        <div className="tg-card flex flex-col items-center py-12 px-6 text-center max-w-sm mx-auto">
          <span className="text-6xl mb-5">⚠️</span>
          <h2 className="text-lg font-semibold text-[var(--tg-theme-text-color)] mb-2">
            Ошибка загрузки
          </h2>
          <p className="text-sm text-[var(--tg-theme-hint-color)] leading-relaxed">
            Не удалось загрузить данные.
            <br />
            Проверьте подключение к серверу.
          </p>
          <details className="w-full mt-4">
            <summary className="text-xs text-[var(--tg-theme-hint-color)] cursor-pointer hover:opacity-70">
              🔧 Техническая информация
            </summary>
            <pre className="mt-2 text-[10px] text-left text-red-500 bg-red-50 rounded-xl p-3 overflow-auto max-h-32">
              {error}
            </pre>
          </details>
          <button onClick={() => navigate(-1)}
            className="mt-6 tg-button text-sm flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Назад
          </button>
          <button onClick={loadData}
            className="mt-3 text-xs text-[var(--tg-theme-button-color)] hover:opacity-70 transition-opacity">
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in pb-24">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tg-theme-text-color)]">
            📅 Занятия
          </h1>
          <p className="text-xs text-[var(--tg-theme-hint-color)] mt-0.5">
            {filteredLessons.length} {filteredLessons.length === 1 ? 'занятие' : filteredLessons.length < 5 ? 'занятия' : 'занятий'}{' '}
            на этой неделе
          </p>
        </div>
        <button onClick={() => navigate('/school')}
          className="text-sm text-[var(--tg-theme-button-color)] flex items-center gap-1 hover:opacity-80 transition-opacity">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Назад
        </button>
      </div>

      {/* ── Week navigation ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button onClick={goPrevWeek}
          className="p-2 rounded-xl hover:bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-hint-color)] transition-all">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="flex-1 flex gap-1 overflow-x-auto">
          {weekDays.map((day, i) => {
            const dateStr = formatDate(day);
            const dayLessons = lessonsByDate[dateStr] || [];
            const isToday = dateStr === getTodayString();
            const hasLessons = dayLessons.length > 0;

            return (
              <button
                key={i}
                onClick={() => {
                  // Scroll to this date's section
                  const el = document.getElementById(`lesson-date-${dateStr}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`flex-1 flex flex-col items-center py-2 px-1 rounded-xl text-center transition-all ${
                  isToday
                    ? 'bg-[var(--tg-theme-button-color)] text-white shadow-md'
                    : 'bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-hint-color)] hover:opacity-80'
                }`}
              >
                <span className="text-[10px] font-medium">{WEEKDAYS[day.getDay()]}</span>
                <span className={`text-sm font-bold leading-tight ${isToday ? 'text-white' : ''}`}>
                  {day.getDate()}
                </span>
                {hasLessons && (
                  <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isToday ? 'bg-white' : 'bg-[var(--tg-theme-button-color)]'}`} />
                )}
              </button>
            );
          })}
        </div>

        <button onClick={goNextWeek}
          className="p-2 rounded-xl hover:bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-hint-color)] transition-all">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* ── Today / Current week label ───────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--tg-theme-hint-color)]">
          {formatDateDisplay(weekStart)} — {formatDateDisplay(weekDays[6])}
        </p>
        {!isCurrentWeek && (
          <button onClick={goCurrentWeek}
            className="text-xs font-medium text-[var(--tg-theme-button-color)] hover:opacity-70 transition-opacity">
            На этой неделе
          </button>
        )}
      </div>

      {/* ── Search ───────────────────────────────────────────────────── */}
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--tg-theme-hint-color)]"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="🔍 Поиск занятия..."
          className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30 transition-all"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[var(--tg-theme-hint-color)]/20 flex items-center justify-center text-[10px] text-[var(--tg-theme-hint-color)] hover:bg-[var(--tg-theme-hint-color)]/30 transition-colors">
            ✕
          </button>
        )}
      </div>

      {/* ── Course filter dropdown ────────────────────────────────────── */}
      {courses.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterCourseId('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              filterCourseId === 'all'
                ? 'border-[var(--tg-theme-button-color)] bg-[var(--tg-theme-button-color)] text-white'
                : 'border-[var(--tg-theme-section-separator-color)] bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)]'
            }`}
          >
            Все курсы
          </button>
          {courses.map(c => (
            <button
              key={c.id}
              onClick={() => setFilterCourseId(filterCourseId === c.id ? 'all' : c.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filterCourseId === c.id
                  ? 'border-[var(--tg-theme-button-color)] bg-[var(--tg-theme-button-color)] text-white'
                  : 'border-[var(--tg-theme-section-separator-color)] bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)]'
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>
      )}

      {/* ── Create/Edit form modal ───────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4 animate-fade-in"
          onClick={closeForm}>
          <div ref={formRef}
            className="bg-[var(--tg-theme-bg-color)] rounded-3xl w-full max-w-lg p-5 pb-8 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[var(--tg-theme-text-color)]">
                {editingLesson ? '✏️ Редактировать занятие' : '➕ Новое занятие'}
              </h3>
              <button onClick={closeForm}
                className="w-8 h-8 rounded-full bg-[var(--tg-theme-secondary-bg-color)] flex items-center justify-center text-sm hover:opacity-70 transition-opacity">
                ✕
              </button>
            </div>

            {/* Course selector */}
            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1.5 block">📚 Курс *</label>
              <div className="flex flex-wrap gap-1.5">
                {courses.map(c => (
                  <button key={c.id}
                    onClick={() => setForm(f => ({ ...f, course_id: c.id }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      form.course_id === c.id
                        ? 'border-[var(--tg-theme-button-color)] bg-[var(--tg-theme-button-color)] text-white'
                        : 'border-[var(--tg-theme-section-separator-color)] bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)]'
                    }`}>
                    {c.title}
                  </button>
                ))}
                {courses.length === 0 && (
                  <p className="text-xs text-[var(--tg-theme-hint-color)]">Нет доступных курсов</p>
                )}
              </div>
            </div>

            {/* Date */}
            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1.5 block">📅 Дата *</label>
              <input type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
            </div>

            {/* Time */}
            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1.5 block">⏰ Время</label>
              <input type="time" value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
            </div>

            {/* Title */}
            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1.5 block">📝 Название</label>
              <input type="text" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Останется название курса, если не указано"
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
            </div>

            {/* Location */}
            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1.5 block">📍 Адрес</label>
              <input type="text" value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="ул. Московская, д. 10"
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
            </div>

            <div className="mb-5">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1.5 block">🔗 Ссылка на карты</label>
              <input type="text" value={form.location_link}
                onChange={e => setForm(f => ({ ...f, location_link: e.target.value }))}
                placeholder="https://yandex.ru/maps/..."
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
            </div>

            {/* Submit */}
            <div className="flex gap-2">
              <button onClick={closeForm}
                className="tg-button-secondary flex-1 text-sm">Отмена</button>
              <button
                onClick={editingLesson ? handleUpdate : handleCreate}
                disabled={saving || !form.course_id || !form.date}
                className="tg-button flex-1 text-sm disabled:opacity-50"
              >
                {saving ? '⏳ Сохранение...' : editingLesson ? '✓ Сохранить' : '✓ Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lessons list grouped by day ──────────────────────────────── */}
      <div className="space-y-4">
        {weekDays.map(day => {
          const dateStr = formatDate(day);
          const dayLessons = lessonsByDate[dateStr];
          const isToday = dateStr === getTodayString();
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          if (!dayLessons || dayLessons.length === 0) {
            // Skip empty weekdays to keep clean, but show today & weekend
            if (!isToday && isWeekend) return null;
            if (!isToday && !isWeekend) return null;
            return null;
          }

          return (
            <div key={dateStr} id={`lesson-date-${dateStr}`}>
              {/* Date header */}
              <div className={`flex items-center gap-2 mb-2 ${isToday ? 'sticky top-0 z-10' : ''}`}>
                <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  isToday
                    ? 'bg-[var(--tg-theme-button-color)] text-white shadow-md'
                    : 'bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)]'
                }`}>
                  {WEEKDAYS[day.getDay()]}
                </div>
                <span className={`text-xs ${isToday ? 'font-bold text-[var(--tg-theme-text-color)]' : 'text-[var(--tg-theme-hint-color)]'}`}>
                  {formatDateDisplay(day)}
                </span>
                <span className="text-[10px] text-[var(--tg-theme-hint-color)] ml-auto">
                  {dayLessons.length} {dayLessons.length === 1 ? 'занятие' : 'занятий'}
                </span>
              </div>

              {/* Lesson cards */}
              <div className="space-y-2">
                {dayLessons.map(lesson => {
                  const statusInfo = getStatusInfo(lesson.status);
                  const unmarkedCount = getUnmarkedCount(lesson);
                  const totalMarked = getTotalMarked(lesson);

                  return (
                    <button
                      key={lesson.id}
                      onClick={() => navigate(`/lesson/${lesson.id}`)}
                      className={`w-full text-left tg-card group hover:shadow-md transition-all duration-200 active:scale-[0.98] ${
                        lesson.status === 'cancelled' ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Time column */}
                        <div className="flex flex-col items-center min-w-[52px] pt-0.5">
                          <span className="text-xl font-bold text-[var(--tg-theme-text-color)] leading-tight">
                            {lesson.time || '—'}
                          </span>
                          <span className={`text-[10px] font-medium mt-0.5 px-1.5 py-0.5 rounded-full ${statusInfo.color}`}>
                            {statusInfo.icon}
                          </span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: lesson.color || getCourseColor(lesson.course_id) }} />
                            <span className="text-sm font-semibold text-[var(--tg-theme-text-color)] truncate">
                              {lesson.title || getCourseTitle(lesson.course_id)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] text-[var(--tg-theme-hint-color)]">
                              {getCourseTitle(lesson.course_id)}
                            </span>
                            {lesson.student_count > 0 && (
                              <>
                                <span className="text-[var(--tg-theme-hint-color)]">·</span>
                                <span className="text-[11px] text-[var(--tg-theme-hint-color)]">
                                  👨‍🎓 {lesson.student_count}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Attendance stats */}
                          {lesson.status !== 'cancelled' && (
                            <div className="flex items-center gap-2 mt-1.5">
                              {lesson.attendance_stats.present > 0 && (
                                <span className="text-[10px] text-green-600">✅ {lesson.attendance_stats.present}</span>
                              )}
                              {lesson.attendance_stats.late > 0 && (
                                <span className="text-[10px] text-amber-600">⏰ {lesson.attendance_stats.late}</span>
                              )}
                              {lesson.attendance_stats.absent > 0 && (
                                <span className="text-[10px] text-red-600">❌ {lesson.attendance_stats.absent}</span>
                              )}
                              {unmarkedCount > 0 && (
                                <span className="text-[10px] text-gray-500">⏳ {unmarkedCount}</span>
                              )}
                              {totalMarked > 0 && unmarkedCount === 0 && (
                                <span className="text-[10px] text-green-600 font-medium">✓ Все отмечены</span>
                              )}
                            </div>
                          )}

                          {/* Location */}
                          {lesson.location && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[10px]">📍</span>
                              <span className="text-[10px] text-[var(--tg-theme-hint-color)] truncate">
                                {lesson.location}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                          {isTeacher && lesson.status !== 'cancelled' && (
                            <button
                              onClick={() => navigate(`/lesson/${lesson.id}`)}
                              className="p-1.5 rounded-xl hover:bg-[var(--tg-theme-secondary-bg-color)] text-xs text-[var(--tg-theme-button-color)] transition-all active:scale-90"
                              title="Отметить посещаемость"
                            >
                              📋
                            </button>
                          )}
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => openEditForm(lesson)}
                                className="p-1.5 rounded-xl hover:bg-[var(--tg-theme-secondary-bg-color)] text-xs text-[var(--tg-theme-button-color)] transition-all active:scale-90"
                                title="Редактировать"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleArchive(lesson)}
                                className="p-1.5 rounded-xl hover:bg-red-50 text-xs text-red-500 transition-all active:scale-90"
                                title="Архивировать"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Empty state — no lessons at all this week */}
        {filteredLessons.length === 0 && lessons.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <span className="text-5xl mb-4">🎉</span>
            <p className="text-base font-semibold text-[var(--tg-theme-text-color)] mb-1">
              На этой неделе занятий нет
            </p>
            <p className="text-xs text-[var(--tg-theme-hint-color)] mb-6">
              {isCurrentWeek
                ? 'Можно отдохнуть или запланировать новые'
                : 'Попробуйте другую неделю'}
            </p>
            {isTeacher && (
              <button onClick={openCreateForm} className="tg-button text-sm py-2 px-6">
                + Добавить занятие
              </button>
            )}
          </div>
        )}

        {/* Empty search results */}
        {filteredLessons.length === 0 && lessons.length > 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <span className="text-4xl mb-3">🔍</span>
            <p className="text-sm font-medium text-[var(--tg-theme-text-color)] mb-1">Ничего не найдено</p>
            <p className="text-xs text-[var(--tg-theme-hint-color)]">Попробуйте изменить поисковый запрос или фильтр</p>
          </div>
        )}
      </div>

      {/* ── Floating action button ────────────────────────────────────── */}
      {isTeacher && lessons.length > 0 && (
        <button
          onClick={openCreateForm}
          className="fixed bottom-20 right-4 z-40 tg-button shadow-lg shadow-[var(--tg-theme-button-color)]/30 rounded-2xl px-5 py-3.5 flex items-center gap-2 text-sm font-semibold animate-slide-up hover:scale-105 active:scale-95 transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Добавить
        </button>
      )}
    </div>
  );
}
