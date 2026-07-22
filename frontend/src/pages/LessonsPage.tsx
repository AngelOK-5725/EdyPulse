import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { type Course } from '../services/api';

// ─── Вспомогательные функции ──────────────────────────────────────────────

/** Проверка пересечения двух временных интервалов [start,end).
 *  Если end_time не указан — fallback на точное совпадение start_time. */
function timesOverlap(
  start1: string, end1: string,
  start2: string, end2: string
): boolean {
  if (!start1 || !start2) return false;
  if (!end1 || !end2) return start1 === start2;
  return start1 < end2 && end1 > start2;
}

function getTimeDisplay(item: { start_time?: string; end_time?: string; time?: string }): string {
  const start = item.start_time || item.time || '';
  const end = item.end_time || '';
  if (start && end) {
    return `${start} — ${end}`;
  }
  return start || '—';
}

interface LessonItem {
  id: string;
  course_id: string;
  date: string;
  time: string;
  start_time: string;
  end_time: string;
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
  start_time: string;
  end_time: string;
  title: string;
  lesson_type: string; // regular | one_time | replacement | make_up
  status: string;
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

const LESSON_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  regular: { label: 'Обычное', icon: '📘', color: 'text-blue-600 bg-blue-50' },
  one_time: { label: 'Разовое', icon: '⭐', color: 'text-amber-600 bg-amber-50' },
  replacement: { label: 'Замена', icon: '🔄', color: 'text-indigo-600 bg-indigo-50' },
  make_up: { label: 'Отработка', icon: '🔁', color: 'text-teal-600 bg-teal-50' },
  cancelled: { label: 'Отмена', icon: '❌', color: 'text-red-600 bg-red-50' },
};

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

  // ── Выбранный день (фильтр)
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // ── Create/Edit form state ───────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LessonItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateLessonData>({
    course_id: '',
    date: getTodayString(),
    time: '',
    start_time: '',
    end_time: '',
    title: '',
    lesson_type: 'regular',
    status: 'scheduled',
    location: '',
    location_link: '',
  });

  // ── Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelLessonDate, setCancelLessonDate] = useState('');

  // ── Reschedule modal state (for 'Перенести на другой день')
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [savingReschedule, setSavingReschedule] = useState(false);
  const [rescheduleConflict, setRescheduleConflict] = useState<string | null>(null);

  // ── Dropdown menu state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // ── Form conflict state
  const [formConflict, setFormConflict] = useState<string | null>(null);

  // ── Make-up picker state
  const [showMakeUpPicker, setShowMakeUpPicker] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    if (openDropdownId) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openDropdownId]);

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
      let weekLessons = allLessons.filter(l => {
        const d = l.date;
        return d >= startDate && d <= endDate;
      });

      // ── Auto-generate missing lessons for courses on scheduled days ──
      // This ensures the weekly schedule shows all expected lessons
      const DAY_MAP: Record<string, number> = {
        'Вс': 0, 'Пн': 1, 'Вт': 2, 'Ср': 3, 'Чт': 4, 'Пт': 5, 'Сб': 6,
      };

      const ensurePromises: Promise<any>[] = [];
      for (const course of coursesData.courses) {
        if (!course.days || course.is_active === 'false') continue;
        const courseDays = course.days.split(',').map((d: string) => d.trim());
        for (const day of weekDays) {
          const dayName = WEEKDAYS[day.getDay()];
          if (courseDays.includes(dayName)) {
            const dateStr = formatDate(day);
            // Check if a lesson for this course+date already exists
            const alreadyExists = weekLessons.some(l => l.course_id === course.id && l.date === dateStr);
            if (!alreadyExists && isTeacher) {
              ensurePromises.push(api.ensureLesson(course.id, dateStr));
            }
          }
        }
      }

      // If we created new lessons, reload the list
      if (ensurePromises.length > 0) {
        await Promise.all(ensurePromises);
        const refreshedData = await api.getLessons();
        const refreshedLessons: LessonItem[] = (refreshedData.lessons || []).map((l: any) => ({
          ...l,
          student_count: l.student_count || 0,
          attendance_stats: l.attendance_stats || { present: 0, late: 0, absent: 0, trial: 0, unmarked: 0, total_marked: 0 },
          unmarked_students: l.unmarked_students || [],
          color: l.color || '#6C5CE7',
        }));
        weekLessons = refreshedLessons.filter(l => {
          const d = l.date;
          return d >= startDate && d <= endDate;
        });
      }

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
  // ── Cancelled lessons (for make-up picker)
  const cancelledLessons = useMemo(() => {
    return lessons.filter(l => l.status === 'cancelled');
  }, [lessons]);

  const lessonsByDate = useMemo(() => {
    const grouped: Record<string, LessonItem[]> = {};
    for (const l of filteredLessons) {
      if (!grouped[l.date]) grouped[l.date] = [];
      grouped[l.date].push(l);
    }
    return grouped;
  }, [filteredLessons]);

  // ── Form handlers ────────────────────────────────────────────────────────
  const openCreateForm = (presetDate?: string) => {
    setEditingLesson(null);
    setFormConflict(null);
    setForm({
      course_id: '',
      date: presetDate || selectedDate || getTodayString(),
      time: '',
      start_time: '',
      end_time: '',
      title: '',
      lesson_type: 'regular',
      status: 'scheduled',
      location: '',
      location_link: '',
    });
    setShowForm(true);
  };

  const openEditForm = (lesson: LessonItem) => {
    setEditingLesson(lesson);
    setFormConflict(null);
    setForm({
      course_id: lesson.course_id,
      date: lesson.date,
      time: lesson.time || '',
      start_time: lesson.start_time || lesson.time || '',
      end_time: lesson.end_time || '',
      title: lesson.title,
      lesson_type: (lesson as any).lesson_type || 'regular',
      status: lesson.status || 'scheduled',
      location: lesson.location || '',
      location_link: lesson.location_link || '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingLesson(null);
    setFormConflict(null);
  };

  // ── Create ───────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.date || (!form.course_id && !form.title)) return;
    setSaving(true);
    try {
      await api.createLesson({
        course_id: form.course_id || undefined,
        date: form.date,
        time: form.start_time || undefined,
        start_time: form.start_time || undefined,
        end_time: form.end_time || undefined,
        title: form.title || undefined,
        lesson_type: form.lesson_type || 'regular',
        status: form.lesson_type === 'cancelled' ? 'cancelled' : (form.status || 'scheduled'),
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
    if (!editingLesson || !form.date || (!form.course_id && !form.title)) return;
    setSaving(true);
    try {
      await api.updateLesson(editingLesson.id, {
        course_id: form.course_id || undefined,
        date: form.date,
        time: form.start_time || undefined,
        start_time: form.start_time || undefined,
        end_time: form.end_time || undefined,
        title: form.title || undefined,
        lesson_type: form.lesson_type || 'regular',
        status: form.lesson_type === 'cancelled' ? 'cancelled' : (form.status || 'scheduled'),
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

  const getLessonTypeInfo = (lesson: LessonItem) => {
    const type = (lesson as any).lesson_type;
    // Не показываем бейдж для обычных (regular) занятий — это состояние по умолчанию
    if (!type || type === 'regular' || type === 'cancelled') return null;
    const info = LESSON_TYPE_LABELS[type] || null;
    if (!info) return null;
    // Для отработки пытаемся извлечь исходную дату из note
    let originalDate = '';
    if (type === 'make_up' && lesson.note) {
      const match = lesson.note.match(/от (\d{4}-\d{2}-\d{2})/);
      if (match) originalDate = match[1];
    }
    return { ...info, originalDate };
  };

  const getUnmarkedCount = (lesson: LessonItem): number => {
    return lesson.attendance_stats?.unmarked ?? 0;
  };

  const getTotalMarked = (lesson: LessonItem): number => {
    return lesson.attendance_stats?.total_marked ?? 0;
  };

  // ── Conflict detection helper (ПРОВЕРЯЕТ ПЕРЕСЕЧЕНИЕ ИНТЕРВАЛОВ) ─────
  const checkLessonConflict = (date: string, start_time: string, end_time: string, excludeId?: string) => {
    if (!date || !start_time) return null;
    const conflict = lessons.find(l => {
      if (l.date !== date) return false;
      if (l.status === 'cancelled') return false;
      if (l.id === excludeId) return false;
      if (l.id === editingLesson?.id) return false;
      // Проверяем пересечение интервалов
      const lStart = l.start_time || l.time || '';
      const lEnd = l.end_time || '';
      return timesOverlap(start_time, end_time, lStart, lEnd);
    });
    if (conflict) {
      const courseTitle = getCourseTitle(conflict.course_id);
      const cStart = conflict.start_time || conflict.time || '';
      const cEnd = conflict.end_time || '';
      const conflictTime = cStart && cEnd ? `${cStart}—${cEnd}` : cStart;
      return `⚠️ «${conflict.title || courseTitle}» уже в этот промежуток (${conflictTime})`;
    }
    return null;
  };

  // ── Reschedule modal handlers ───────────────────────────────────────────
  const openRescheduleModal = () => {
    if (!editingLesson) return;
    setRescheduleDate(new Date().toISOString().split('T')[0]);
    setRescheduleTime(editingLesson.time || '');
    setRescheduleConflict(null);
    setShowRescheduleModal(true);
  };

  const handleRescheduleConfirm = async () => {
    if (!editingLesson || !rescheduleDate) return;
    setSavingReschedule(true);
    try {
      // 1. Create a new make-up lesson
      const newLesson = await api.createLesson({
        course_id: editingLesson.course_id || undefined,
        date: rescheduleDate,                        time: rescheduleTime || editingLesson.start_time || editingLesson.time || undefined,
                        start_time: rescheduleTime || editingLesson.start_time || undefined,
                        end_time: editingLesson.end_time || undefined,
        title: `Отработка: ${editingLesson.title}`,
        lesson_type: 'make_up',
        status: 'scheduled',
        note: `Отработка отменённого занятия от ${editingLesson.date}`,
        location: editingLesson.location || undefined,
        location_link: editingLesson.location_link || undefined,
      });

      // 2. Update original lesson as cancelled with rescheduled_to
      await api.updateLesson(editingLesson.id, {
        status: 'cancelled',
        rescheduled_to: newLesson.id,
      });

      setShowRescheduleModal(false);
      setShowCancelModal(false);
      closeForm();
      await loadData();
    } catch (e) {
      console.error('Failed to reschedule:', e);
      alert('Ошибка при переносе занятия');
    } finally {
      setSavingReschedule(false);
    }
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
                  setSelectedDate(dateStr);
                  const el = document.getElementById(`lesson-date-${dateStr}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`flex-1 flex flex-col items-center py-2 px-1 rounded-xl text-center transition-all ${
                  selectedDate === dateStr
                    ? 'bg-[var(--tg-theme-button-color)] text-white shadow-md ring-2 ring-white/50'
                    : isToday
                      ? 'bg-[var(--tg-theme-button-color)]/80 text-white shadow-md'
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 animate-fade-in"
          onClick={closeForm}>
          <div ref={formRef}
            className="bg-[var(--tg-theme-bg-color)] rounded-3xl w-full max-w-lg p-5 shadow-2xl animate-slide-up max-h-[85vh] overflow-y-auto"
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

            {/* Course selector - optional */}
            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1.5 block">📚 Курс</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setForm(f => ({ ...f, course_id: '' }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    !form.course_id
                      ? 'border-[var(--tg-theme-button-color)] bg-[var(--tg-theme-button-color)] text-white'
                      : 'border-[var(--tg-theme-section-separator-color)] bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)]'
                  }`}>
                  ➖ Не выбран
                </button>
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

            {/* Lesson type selector */}
            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1.5 block">🏷️ Тип занятия</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: 'regular', label: '📘 Обычное' },
                  { value: 'one_time', label: '⭐ Разовое' },
                  { value: 'replacement', label: '🔄 Замена' },
                  { value: 'make_up', label: '🔁 Отработка' },
                ].map(type => {
                  const isMakeUp = type.value === 'make_up';
                  const isReplacement = type.value === 'replacement';
                  const hasCancelledLessons = cancelledLessons.length > 0;
                  const isDisabled = (isMakeUp && !hasCancelledLessons && !editingLesson) || isReplacement;

                  return (
                    <button key={type.value}
                      onClick={() => {
                        if (isDisabled) return;

                        if (isMakeUp && hasCancelledLessons && !editingLesson) {
                          // Show make-up picker first
                          setShowMakeUpPicker(true);
                          return;
                        }

                        setForm(f => ({ ...f, lesson_type: type.value }));
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        isDisabled
                          ? 'opacity-40 cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
                          : form.lesson_type === type.value
                            ? 'border-[var(--tg-theme-button-color)] bg-[var(--tg-theme-button-color)] text-white'
                            : 'border-[var(--tg-theme-section-separator-color)] bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)] hover:opacity-80'
                      }`}
                      title={isReplacement ? '🚧 В разработке' : isDisabled ? 'Нет отменённых занятий для возмещения' : type.label}
                    >
                      {type.label}
                      {isMakeUp && !editingLesson && (
                        <span className="ml-1 text-[9px] opacity-70">({cancelledLessons.length})</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date */}
            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1.5 block">📅 Дата *</label>
              <input type="date" value={form.date}
                onChange={e => {
                  setForm(f => ({ ...f, date: e.target.value }));
                  setFormConflict(checkLessonConflict(e.target.value, form.start_time, form.end_time, editingLesson?.id));
                }}
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
            </div>

            {/* Start time & End time */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1 block">🕐 Начало</label>
                <input type="time" value={form.start_time}
                  onChange={e => {
                    const newStart = e.target.value;
                    setForm(f => ({ ...f, start_time: newStart, time: newStart }));
                    setFormConflict(checkLessonConflict(form.date, newStart, form.end_time, editingLesson?.id));
                  }}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1 block">⏰ Конец</label>
                <input type="time" value={form.end_time}
                  onChange={e => {
                    const newEnd = e.target.value;
                    setForm(f => ({ ...f, end_time: newEnd }));
                    setFormConflict(checkLessonConflict(form.date, form.start_time, newEnd, editingLesson?.id));
                  }}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
              </div>
            </div>

            {/* Conflict warning */}
            {formConflict && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <span>⚠️</span>
                <span>{formConflict}</span>
              </div>
            )}

            {/* Title — обязательно, если не выбран курс */}
            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1.5 block">
                📝 Название
                {!form.course_id && <span className="text-red-500 ml-1">* обязательно</span>}
              </label>
              <input type="text" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder={form.course_id ? 'Останется название курса, если не указано' : 'Укажите название занятия'}
                className={`w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30 ${
                  !form.course_id && !form.title ? 'ring-1 ring-red-300' : ''
                }`} />
              {!form.course_id && !form.title && (
                <p className="text-[10px] text-red-500 mt-1">Укажите название — курс не выбран</p>
              )}
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
                disabled={saving || !form.date || (!form.course_id && !form.title) || !!formConflict}
                className="tg-button flex-1 text-sm disabled:opacity-50"
                title={formConflict ? 'Это время уже занято другим уроком' : ''}
              >
                {saving ? '⏳ Сохранение...' : editingLesson ? '✓ Сохранить' : '✓ Создать'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── Cancel lesson modal ──────────────────────────────────────── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-3 animate-fade-in"
          onClick={() => {
            setShowCancelModal(false);
            setForm(f => ({ ...f, lesson_type: 'regular' }));
          }}>
          <div
            className="bg-[var(--tg-theme-bg-color)] rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-slide-up"
            onClick={e => e.stopPropagation()}>

            <div className="text-center mb-5">
              <span className="text-5xl block mb-3">🤔</span>
              <h3 className="text-lg font-bold text-[var(--tg-theme-text-color)] mb-1">
                Когда проведём отменённое занятие?
              </h3>
              <p className="text-xs text-[var(--tg-theme-hint-color)]">
                Выберите, что делать с этим занятием
              </p>
            </div>

            <div className="space-y-2">
              {/* Option: Today */}
              <button
                onClick={async () => {
                  setShowCancelModal(false);
                  setSaving(true);
                  try {
                    if (!editingLesson) return;
                    // 1. Create a new make-up lesson for today
                    const newLesson = await api.createLesson({
                      course_id: editingLesson.course_id || undefined,
                      date: getTodayString(),
                      time: editingLesson.start_time || editingLesson.time || undefined,
                      start_time: editingLesson.start_time || editingLesson.time || undefined,
                      end_time: editingLesson.end_time || undefined,
                      title: `Отработка: ${editingLesson.title}`,
                      lesson_type: 'make_up',
                      status: 'scheduled',
                      note: `Отработка отменённого занятия от ${editingLesson.date}`,
                      location: editingLesson.location || undefined,
                      location_link: editingLesson.location_link || undefined,
                    });
                    // 2. Update original lesson as cancelled with rescheduled_to
                    await api.updateLesson(editingLesson.id, {
                      status: 'cancelled',
                      rescheduled_to: newLesson.id,
                    });
                    closeForm();
                    await loadData();
                  } catch (e) {
                    console.error('Failed to save:', e);
                    alert('Ошибка при сохранении');
                  } finally {
                    setSaving(false);
                  }
                }}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all hover:shadow-md active:scale-[0.98] ${saving ? 'opacity-50 pointer-events-none' : ''} border-green-200 bg-green-50 hover:border-green-300`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📅</span>
                  <div>
                    <span className="text-sm font-semibold text-green-800 block">Проведём сегодня</span>
                    <span className="text-[11px] text-green-600">Создать отработку на сегодня</span>
                  </div>
                </div>
              </button>

              {/* Option: Reschedule */}
              <button
                onClick={() => {
                  openRescheduleModal();
                }}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all hover:shadow-md active:scale-[0.98] ${saving ? 'opacity-50 pointer-events-none' : ''} border-amber-200 bg-amber-50 hover:border-amber-300`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔄</span>
                  <div>
                    <span className="text-sm font-semibold text-amber-800 block">Перенести на другой день</span>
                    <span className="text-[11px] text-amber-600">Выбрать новую дату и время</span>
                  </div>
                </div>
              </button>

              {/* Option: Mark later */}
              <button
                onClick={async () => {
                  setShowCancelModal(false);
                  setSaving(true);
                  try {
                    const data = {
                      course_id: form.course_id || undefined,
                      date: form.date,
                      time: form.time || undefined,
                      title: form.title || undefined,
                      lesson_type: 'cancelled',
                      status: 'cancelled',
                      location: form.location || undefined,
                      location_link: form.location_link || undefined,
                    };
                    let savedLesson;
                    if (editingLesson) {
                      savedLesson = await api.updateLesson(editingLesson.id, data);
                    } else {
                      savedLesson = await api.createLesson(data);
                    }

                    // Save reminder to localStorage
                    const reminder: any = {
                      id: 'rem_' + Date.now(),
                      lesson_id: editingLesson?.id || savedLesson?.id || '',
                      course_id: form.course_id || '',
                      title: form.title || getCourseTitle(form.course_id) || 'Занятие',
                      original_date: form.date,
                      time: form.time || '',
                      created_at: new Date().toISOString(),
                      type: 'cancelled_mark_later',
                    };
                    reminder.time = form.time || '';
                    const existing = JSON.parse(localStorage.getItem('edu_pulse_reminders') || '[]');
                    existing.push(reminder);
                    localStorage.setItem('edu_pulse_reminders', JSON.stringify(existing));

                    closeForm();
                    await loadData();
                  } catch (e) {
                    console.error('Failed to save:', e);
                    alert('Ошибка при сохранении');
                  } finally {
                    setSaving(false);
                  }
                }}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all hover:shadow-md active:scale-[0.98] ${saving ? 'opacity-50 pointer-events-none' : ''} border-purple-200 bg-purple-50 hover:border-purple-300`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⏰</span>
                  <div>
                    <span className="text-sm font-semibold text-purple-800 block">Отмечу позже</span>
                    <span className="text-[11px] text-purple-600">Напомнить в Inbox (Важные)</span>
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={() => {
                setShowCancelModal(false);
                setForm(f => ({ ...f, lesson_type: 'regular' }));
              }}
              className="w-full mt-4 py-3 rounded-xl text-sm text-[var(--tg-theme-hint-color)] hover:opacity-70 transition-opacity"
            >
              Назад
            </button>
          </div>
        </div>
      )}


      {/* ── Reschedule modal — выбор новой даты и времени для переноса */}
      {showRescheduleModal && editingLesson && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-3 animate-fade-in"
          onClick={() => { setShowRescheduleModal(false); }}>
          <div className="bg-[var(--tg-theme-bg-color)] rounded-3xl w-full max-w-sm p-5 shadow-2xl animate-slide-up"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">🔄 Перенести занятие</h3>
              <button onClick={() => setShowRescheduleModal(false)}
                className="w-8 h-8 rounded-full bg-[var(--tg-theme-secondary-bg-color)] flex items-center justify-center text-sm hover:opacity-70 transition-opacity">
                ✕
              </button>
            </div>

            <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <p className="text-xs font-semibold text-amber-800">{editingLesson.title || getCourseTitle(editingLesson.course_id)}</p>
              <p className="text-[10px] text-amber-600 mt-0.5">
                Отменяется {editingLesson.date} в {getTimeDisplay(editingLesson)}
              </p>
            </div>

            <div className="mb-3">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1 block">📆 Новая дата *</label>
              <input type="date" value={rescheduleDate}
                onChange={e => {
                  setRescheduleDate(e.target.value);
                  setRescheduleConflict(checkLessonConflict(e.target.value, rescheduleTime, editingLesson.end_time || '', editingLesson.id));
                }}
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
            </div>

            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1 block">⏰ Новое время</label>
              <input type="time" value={rescheduleTime}
                onChange={e => {
                  setRescheduleTime(e.target.value);
                  setRescheduleConflict(checkLessonConflict(rescheduleDate, e.target.value, editingLesson.end_time || '', editingLesson.id));
                }}
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
            </div>

            {rescheduleConflict && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <span>⚠️</span>
                <span>{rescheduleConflict}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowRescheduleModal(false)}
                className="tg-button-secondary flex-1 text-sm">Отмена</button>
              <button onClick={handleRescheduleConfirm}
                disabled={savingReschedule || !rescheduleDate || !!rescheduleConflict}
                className="tg-button flex-1 text-sm disabled:opacity-50">
                {savingReschedule ? '⏳ Перенос...' : '✅ Перенести'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Make-up picker modal — выбор отменённого занятия для возмещения */}
      {showMakeUpPicker && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-3 animate-fade-in"
          onClick={() => { setShowMakeUpPicker(false); setForm(f => ({ ...f, lesson_type: 'regular' })); }}>
          <div
            className="bg-[var(--tg-theme-bg-color)] rounded-3xl w-full max-w-sm p-5 shadow-2xl animate-slide-up max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--tg-theme-text-color)]">🔁 Выберите занятие для отработки</h3>
              <button onClick={() => { setShowMakeUpPicker(false); setForm(f => ({ ...f, lesson_type: 'regular' })); }}
                className="w-8 h-8 rounded-full bg-[var(--tg-theme-secondary-bg-color)] flex items-center justify-center text-sm hover:opacity-70 transition-opacity">
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--tg-theme-hint-color)] mb-4">
              Выберите отменённое занятие, которое хотите возместить
            </p>

            <div className="space-y-2">
              {cancelledLessons.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-3xl block mb-2">📭</span>
                  <p className="text-sm text-[var(--tg-theme-hint-color)]">Нет отменённых занятий</p>
                </div>
              ) : (
                cancelledLessons.map(cl => (
                  <button key={cl.id}
                    onClick={() => {
                      setForm(f => ({
                        ...f,
                        course_id: cl.course_id,
                        lesson_type: 'make_up',
                        title: `Отработка: ${cl.title || getCourseTitle(cl.course_id)}`,
                        date: getTodayString(),
                        time: cl.start_time || cl.time || '',
                        start_time: cl.start_time || cl.time || '',
                        end_time: cl.end_time || '',
                      }));
                      setShowMakeUpPicker(false);
                      setShowForm(true);
                    }}
                    className="w-full text-left p-3.5 rounded-2xl border-2 border-teal-200 bg-teal-50 hover:border-teal-300 hover:shadow-sm transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0">📅</span>
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-semibold text-teal-800 block truncate">
                          {cl.title || getCourseTitle(cl.course_id)}
                        </span>
                        <span className="text-[11px] text-teal-600">
                          {cl.date} {cl.time ? `· ${cl.time}` : ''}
                          {' · '}{getCourseTitle(cl.course_id)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={() => { setShowMakeUpPicker(false); setForm(f => ({ ...f, lesson_type: 'regular' })); }}
              className="w-full mt-4 py-3 rounded-xl text-sm text-[var(--tg-theme-hint-color)] hover:opacity-70 transition-opacity"
            >
              Отмена
            </button>
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
          const hasLessons = dayLessons && dayLessons.length > 0;
          const isSelected = selectedDate === dateStr;

          // Если выбран конкретный день — показываем только его
          if (selectedDate && !isSelected) return null;

          return (
            <div key={dateStr} id={`lesson-date-${dateStr}`}
              className={`scroll-mt-16 transition-all duration-300 ${
                isSelected && hasLessons
                  ? 'ring-2 ring-[var(--tg-theme-button-color)]/20 rounded-2xl p-3 -mx-1 bg-[var(--tg-theme-button-color)]/[0.03]'
                  : ''
              }`}
            >
              {/* Date header — кликабельный */}
              <div className={`flex items-center gap-2 mb-2 ${isToday ? 'sticky top-0 z-10' : ''}`}>
                <button
                  onClick={() => {
                    // Повторный клик по тому же дню — сброс фильтра
                    if (isSelected) {
                      setSelectedDate(null);
                    } else {
                      setSelectedDate(dateStr);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95 ${
                    isSelected
                      ? 'bg-[var(--tg-theme-button-color)] text-white shadow-md'
                      : isToday
                        ? 'bg-[var(--tg-theme-button-color)]/80 text-white shadow-md'
                        : 'bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)]'
                  }`}
                >
                  {WEEKDAYS[day.getDay()]}
                </button>
                <span className={`text-xs ${isToday || isSelected ? 'font-bold text-[var(--tg-theme-text-color)]' : 'text-[var(--tg-theme-hint-color)]'}`}>
                  {formatDateDisplay(day)}
                </span>
                <span className="text-[10px] text-[var(--tg-theme-hint-color)] ml-auto">
                  {hasLessons ? `${dayLessons!.length} ${dayLessons!.length === 1 ? 'занятие' : 'занятий'}` : ''}
                </span>
                {selectedDate && isSelected && (
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="text-[10px] text-[var(--tg-theme-button-color)] font-medium hover:opacity-70 transition-opacity"
                  >
                    Все дни
                  </button>
                )}
              </div>

              {/* Lesson cards или пустое состояние */}
              {hasLessons ? (
                <div className="space-y-2">
                  {dayLessons!.map(lesson => {
                    const statusInfo = getStatusInfo(lesson.status);
                    const lessonTypeInfo = getLessonTypeInfo(lesson);
                    const unmarkedCount = getUnmarkedCount(lesson);
                    const totalMarked = getTotalMarked(lesson);

                    return (
                      <button
                        key={lesson.id}
                        onClick={() => navigate(`/lesson/${lesson.id}`)}
                        className={`w-full text-left tg-card group hover:shadow-md transition-all duration-200 active:scale-[0.98] ${
                          lesson.status === 'cancelled' ? 'opacity-60 ring-1 ring-red-300' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Time column */}
                          <div className="flex flex-col items-center min-w-[52px] pt-0.5">
                            <span className="text-xl font-bold text-[var(--tg-theme-text-color)] leading-tight">
                              {getTimeDisplay(lesson)}
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
                              {/* Lesson type badge */}
                              {lessonTypeInfo && lesson.status !== 'cancelled' && (
                                <span className={`text-[9px] font-medium ${lessonTypeInfo.color} px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap`}>
                                  {lessonTypeInfo.icon} {lessonTypeInfo.label}
                                  {'originalDate' in lessonTypeInfo && (lessonTypeInfo as any).originalDate
                                    ? ` с ${(lessonTypeInfo as any).originalDate}`
                                    : ''}
                                </span>
                              )}
                              {lesson.status === 'cancelled' && (
                                <span className="text-[9px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full shrink-0">
                                  ❌ Отменено
                                </span>
                              )}
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

                            {/* Attendance stats — скрываем для отменённых */}
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

                          {/* Actions — dropdown menu */}
                          <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setOpenDropdownId(openDropdownId === lesson.id ? null : lesson.id)}
                              className="p-1.5 rounded-xl hover:bg-[var(--tg-theme-secondary-bg-color)] text-sm text-[var(--tg-theme-hint-color)] transition-all active:scale-90"
                              title="Действия"
                            >
                              ⋮
                            </button>

                            {openDropdownId === lesson.id && (
                              <div ref={dropdownRef}
                                className="absolute right-0 top-full mt-1 w-44 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-30 animate-slide-up overflow-hidden"
                              >
                                {/* Edit (admins) */}
                                {isAdmin && (
                                  <button
                                    onClick={() => { setOpenDropdownId(null); openEditForm(lesson); }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-left hover:bg-gray-50 transition-colors"
                                  >
                                    <span>✏️</span>
                                    <span>Редактировать</span>
                                  </button>
                                )}

                                {/* Cancel (teachers+, non-cancelled) */}
                                {isTeacher && lesson.status !== 'cancelled' && lesson.status !== 'completed' && (
                                  <button
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      // Open cancel modal for existing lesson
                                      setEditingLesson(lesson);
                                      setForm({
                                        course_id: lesson.course_id,
                                        date: lesson.date,
                                        time: lesson.start_time || lesson.time || '',
                                        start_time: lesson.start_time || lesson.time || '',
                                        end_time: lesson.end_time || '',
                                        title: lesson.title,
                                        lesson_type: 'cancelled',
                                        status: lesson.status || 'scheduled',
                                        location: lesson.location || '',
                                        location_link: lesson.location_link || '',
                                      });
                                      setCancelLessonDate(lesson.date);
                                      setShowCancelModal(true);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-left hover:bg-red-50 transition-colors text-red-600"
                                  >
                                    <span>❌</span>
                                    <span>Отменить занятие</span>
                                  </button>
                                )}

                                {/* Divider */}
                                {isTeacher && (
                                  <div className="mx-3 my-1 border-t border-gray-100" />
                                )}

                                {/* Archive (teachers+) */}
                                {isTeacher && (
                                  <button
                                    onClick={() => { setOpenDropdownId(null); handleArchive(lesson); }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-left hover:bg-gray-50 transition-colors text-gray-500"
                                  >
                                    <span>🗑️</span>
                                    <span>Архивировать</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--tg-theme-secondary-bg-color)]">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📭</span>
                    <span className="text-xs text-[var(--tg-theme-hint-color)]">
                      {isWeekend ? 'Выходной' : 'Занятий нет'}
                    </span>
                  </div>
                  {isTeacher && (
                    <button
                      onClick={() => openCreateForm(dateStr)}
                      className="text-xs font-medium text-[var(--tg-theme-button-color)] flex items-center gap-1 hover:opacity-70 transition-opacity"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Добавить
                    </button>
                  )}
                </div>
              )}
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
              <button onClick={() => openCreateForm()} className="tg-button text-sm py-2 px-6">
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
          onClick={() => openCreateForm()}
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
