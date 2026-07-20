import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { type Course } from '../services/api';

const COLORS = ['#6C5CE7', '#00B894', '#FD79A8', '#FDCB6E', '#0984E3', '#E17055', '#00CEC9', '#636E72'];
const DAYS_OPTIONS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

interface CourseForm {
  title: string;
  description: string;
  time: string;
  price: string;
  monthly_price: string;
  lesson_price: string;
  lessons_per_week: string;
  payment_type: string;
  color: string;
  days: string[];
  location: string;
  location_link: string;
}

const EMPTY_FORM: CourseForm = {
  title: '',
  description: '',
  time: '',
  price: '',
  monthly_price: '',
  lesson_price: '',
  lessons_per_week: '',
  payment_type: 'monthly',
  color: '#6C5CE7',
  days: [],
  location: '',
  location_link: '',
};

export default function CoursesPage() {
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const isTeacher = permissions.canEditStudents; // user+ roles
  const isAdmin = permissions.canManageUsers;    // admin+

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Create / Edit form state ─────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CourseForm>(EMPTY_FORM);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getCourses();
      setCourses(data.courses);
    } catch (e) {
      console.error('CoursesPage: Failed to load courses:', e);
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  // ── Search filter ────────────────────────────────────────────────────
  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return courses;
    const q = searchQuery.toLowerCase().trim();
    return courses.filter(c =>
      c.title.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q)) ||
      (c.days && c.days.toLowerCase().includes(q))
    );
  }, [courses, searchQuery]);

  // ── Helpers ──────────────────────────────────────────────────────────
  const getStudentCount = (course: Course): number => {
    if (!course.student_ids) return 0;
    return course.student_ids.split(',').filter(Boolean).length;
  };

  const formatDays = (days: string): string => {
    if (!days) return '';
    return days.split(',').join(', ');
  };

  const isCourseActive = (course: Course): boolean => {
    return course.is_active !== 'false';
  };

  const openCreateForm = () => {
    setEditingCourse(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEditForm = (course: Course) => {
    setEditingCourse(course);
    setForm({
      title: course.title,
      description: course.description || '',
      time: course.time || '',
      price: course.price || '',
      monthly_price: course.monthly_price || '',
      lesson_price: course.lesson_price || '',
      lessons_per_week: course.lessons_per_week || '',
      payment_type: course.payment_type || 'monthly',
      color: course.color || '#6C5CE7',
      days: course.days ? course.days.split(',').filter(Boolean) : [],
      location: course.location || '',
      location_link: course.location_link || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCourse(null);
    setForm(EMPTY_FORM);
  };

  const toggleDay = (day: string) => {
    setForm(f => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day],
    }));
  };

  // ── Create ───────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await api.createCourse({
        title: form.title,
        description: form.description || undefined,
        time: form.time || undefined,
        price: form.price,
        monthly_price: form.monthly_price || undefined,
        lesson_price: form.lesson_price || undefined,
        lessons_per_week: form.lessons_per_week || undefined,
        payment_type: form.payment_type || undefined,
        color: form.color,
        days: form.days.join(','),
        location: form.location || undefined,
        location_link: form.location_link || undefined,
      });
      closeForm();
      await loadCourses();
    } catch (e) {
      console.error('Failed to create course:', e);
      alert('Ошибка при создании курса');
    } finally {
      setSaving(false);
    }
  };

  // ── Update ───────────────────────────────────────────────────────────
  const handleUpdate = async () => {
    if (!editingCourse || !form.title.trim()) return;
    setSaving(true);
    try {
      await api.updateCourse(editingCourse.id, {
        title: form.title,
        description: form.description || undefined,
        time: form.time || undefined,
        price: form.price,
        monthly_price: form.monthly_price || undefined,
        lesson_price: form.lesson_price || undefined,
        lessons_per_week: form.lessons_per_week || undefined,
        payment_type: form.payment_type || undefined,
        color: form.color,
        days: form.days.join(','),
        location: form.location || undefined,
        location_link: form.location_link || undefined,
      });
      closeForm();
      await loadCourses();
    } catch (e) {
      console.error('Failed to update course:', e);
      alert('Ошибка при сохранении курса');
    } finally {
      setSaving(false);
    }
  };

  // ── Archive (soft-delete) ────────────────────────────────────────────
  const handleArchive = async (course: Course) => {
    const label = isCourseActive(course) ? 'архивировать' : 'восстановить';
    if (!window.confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} курс «${course.title}»?`)) return;
    try {
      if (isCourseActive(course)) {
        // Soft-delete via DELETE endpoint
        await api.deleteCourse(course.id);
      } else {
        // Restore via PUT — set is_active back to "true"
        await api.updateCourse(course.id, { is_active: 'true' });
      }
      await loadCourses();
    } catch (e) {
      console.error(`Failed to ${label} course:`, e);
      alert(`Ошибка при ${label} курса`);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 space-y-4 animate-fade-in">
        <div className="skeleton h-8 w-32 mb-1" />
        <div className="skeleton h-10 w-full rounded-2xl mb-2" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  // ── Error state (API недоступен) ─────────────────────────────────────
  if (error) {
    return (
      <div className="p-4 animate-fade-in min-h-full flex flex-col items-center justify-center">
        <div className="tg-card flex flex-col items-center py-12 px-6 text-center max-w-sm mx-auto">
          <span className="text-6xl mb-5">🚧</span>
          <h2 className="text-lg font-semibold text-[var(--tg-theme-text-color)] mb-2">
            Раздел находится в разработке
          </h2>
          <p className="text-sm text-[var(--tg-theme-hint-color)] leading-relaxed">
            Эта возможность появится
            <br />
            в одном из следующих обновлений EduPulse.
          </p>
          {/* Техническая информация для разработчика */}
          <details className="w-full mt-4">
            <summary className="text-xs text-[var(--tg-theme-hint-color)] cursor-pointer hover:opacity-70">
              🔧 Техническая информация
            </summary>
            <pre className="mt-2 text-[10px] text-left text-red-500 bg-red-50 rounded-xl p-3 overflow-auto max-h-32">
              {error}
            </pre>
          </details>
          <button
            onClick={() => navigate(-1)}
            className="mt-6 tg-button text-sm flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Назад
          </button>
          <button
            onClick={loadCourses}
            className="mt-3 text-xs text-[var(--tg-theme-button-color)] hover:opacity-70 transition-opacity"
          >
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
            📚 Курсы
          </h1>
          <p className="text-xs text-[var(--tg-theme-hint-color)] mt-0.5">
            {courses.length} {courses.length === 1 ? 'курс' : courses.length < 5 ? 'курса' : 'курсов'}
          </p>
        </div>
        <button
          onClick={() => navigate('/school')}
          className="text-sm text-[var(--tg-theme-button-color)] flex items-center gap-1 hover:opacity-80 transition-opacity"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Назад
        </button>
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
          placeholder="🔍 Поиск курса..."
          className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[var(--tg-theme-hint-color)]/20 flex items-center justify-center text-[10px] text-[var(--tg-theme-hint-color)] hover:bg-[var(--tg-theme-hint-color)]/30 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Create/Edit form (inline) ────────────────────────────────── */}
      {showForm && (
        <div className="tg-card space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[var(--tg-theme-text-color)]">
              {editingCourse ? '✏️ Редактировать курс' : '✏️ Новый курс'}
            </h3>
            <button onClick={closeForm} className="w-7 h-7 rounded-full bg-[var(--tg-theme-secondary-bg-color)] flex items-center justify-center text-xs hover:opacity-70 transition-opacity">✕</button>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">Название *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Робототехника Junior"
              className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">Описание</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Основы робототехники для начинающих"
              className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
          </div>

          {/* Time + Price row */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">Время</label>
              <input value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                placeholder="17:00"
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">Цена (₸)</label>
              <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="40000" type="number"
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
            </div>
          </div>

          {/* Tariff fields */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">Абонемент (₸)</label>
              <input value={form.monthly_price} onChange={e => setForm(f => ({ ...f, monthly_price: e.target.value }))}
                placeholder="40000" type="number"
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">Разовое (₸)</label>
              <input value={form.lesson_price} onChange={e => setForm(f => ({ ...f, lesson_price: e.target.value }))}
                placeholder="5000" type="number"
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">Занятий/нед</label>
              <input value={form.lessons_per_week} onChange={e => setForm(f => ({ ...f, lessons_per_week: e.target.value }))}
                placeholder="2" type="number"
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
            </div>
          </div>

          {/* Days selector */}
          <div>
            <p className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-2">📅 Дни недели</p>
            <div className="flex flex-wrap gap-2">
              {DAYS_OPTIONS.map(day => (
                <button key={day} onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    form.days.includes(day)
                      ? 'border-[var(--tg-theme-button-color)] bg-[var(--tg-theme-button-color)] text-white'
                      : 'border-[var(--tg-theme-section-separator-color)] bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)]'
                  }`}>
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">📍 Адрес</label>
            <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="ул. Московская, д. 10"
              className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">🔗 Ссылка на карты</label>
            <input value={form.location_link} onChange={e => setForm(f => ({ ...f, location_link: e.target.value }))}
              placeholder="https://yandex.ru/maps/..."
              className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
          </div>

          {/* Color picker */}
          <div>
            <p className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-2">🎨 Цвет</p>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-8 h-8 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-[var(--tg-theme-button-color)] scale-110' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button onClick={closeForm} className="tg-button-secondary flex-1 text-sm">Отмена</button>
            <button
              onClick={editingCourse ? handleUpdate : handleCreate}
              disabled={saving || !form.title.trim()}
              className="tg-button flex-1 text-sm disabled:opacity-50"
            >
              {saving ? '⏳ Сохранение...' : editingCourse ? '✓ Сохранить' : '✓ Создать'}
            </button>
          </div>
        </div>
      )}

      {/* ── Course list ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        {filteredCourses.map(course => {
          const active = isCourseActive(course);
          const studentCount = getStudentCount(course);

          return (
            <button
              key={course.id}
              onClick={() => navigate(`/school/courses/${course.id}`)}
              className="w-full text-left tg-card group hover:shadow-md transition-all duration-200 active:scale-[0.98]"
            >
              <div className="flex items-start gap-3.5">
                {/* Color indicator + icon */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg transition-transform group-hover:scale-105 ${
                      active ? 'text-white' : 'bg-gray-200 text-gray-400'
                    }`}
                    style={{ backgroundColor: active ? course.color : undefined }}
                  >
                    📚
                  </div>
                  {/* Color dot */}
                  {active && (
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: course.color }} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold truncate ${active ? 'text-[var(--tg-theme-text-color)]' : 'text-gray-400'}`}>
                      {course.title}
                    </span>
                    {!active && (
                      <span className="text-[9px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">
                        Архив
                      </span>
                    )}
                  </div>

                  {/* Details row */}
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1">
                    {course.days && (
                      <span className="text-[11px] text-[var(--tg-theme-hint-color)]">
                        📅 {formatDays(course.days)}
                      </span>
                    )}
                    {course.time && (
                      <span className="text-[11px] text-[var(--tg-theme-hint-color)]">
                        ⏰ {course.time}
                      </span>
                    )}
                    {studentCount > 0 && (
                      <span className="text-[11px] text-[var(--tg-theme-hint-color)]">
                        👨‍🎓 {studentCount} {studentCount === 1 ? 'ученик' : studentCount < 5 ? 'ученика' : 'учеников'}
                      </span>
                    )}
                  </div>

                  {/* Location */}
                  {course.location && active && (
                    <div className="mt-1">
                      {course.location_link ? (
                        <a href={course.location_link} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-[11px] text-[var(--tg-theme-button-color)] underline underline-offset-2 hover:opacity-80 transition-opacity">
                          📍 {course.location}
                        </a>
                      ) : (
                        <span className="text-[11px] text-[var(--tg-theme-hint-color)]">📍 {course.location}</span>
                      )}
                    </div>
                  )}

                  {/* Price */}
                  {course.price && active && (
                    <div className="mt-1">
                      <span className="text-[11px] font-medium text-green-600">
                        {parseFloat(course.price).toLocaleString()} ₸
                      </span>
                      {course.monthly_price && (
                        <span className="text-[10px] text-[var(--tg-theme-hint-color)] ml-1">
                          / {parseFloat(course.monthly_price).toLocaleString()} ₸ абонемент
                        </span>
                      )}
                    </div>
                  )}

                  {/* Description preview */}
                  {course.description && active && (
                    <p className="text-[11px] text-[var(--tg-theme-hint-color)] mt-1 line-clamp-1">
                      {course.description}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  {isAdmin && (
                    <button
                      onClick={() => openEditForm(course)}
                      className="p-1.5 rounded-xl hover:bg-[var(--tg-theme-secondary-bg-color)] text-xs text-[var(--tg-theme-button-color)] transition-all active:scale-90"
                      title="Редактировать"
                    >
                      ✏️
                    </button>
                  )}
                  <button
                    onClick={() => handleArchive(course)}
                    className={`p-1.5 rounded-xl text-xs transition-all active:scale-90 ${
                      active
                        ? 'hover:bg-amber-50 text-amber-500'
                        : 'hover:bg-green-50 text-green-500'
                    }`}
                    title={active ? 'Архивировать' : 'Восстановить'}
                  >
                    {active ? '📦' : '↩️'}
                  </button>
                </div>
              </div>
            </button>
          );
        })}

        {/* Empty states */}
        {filteredCourses.length === 0 && courses.length > 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <span className="text-4xl mb-3">🔍</span>
            <p className="text-sm font-medium text-[var(--tg-theme-text-color)] mb-1">Ничего не найдено</p>
            <p className="text-xs text-[var(--tg-theme-hint-color)]">Попробуйте изменить поисковый запрос</p>
          </div>
        )}
        {courses.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <span className="text-5xl mb-4">📚</span>
            <p className="text-base font-semibold text-[var(--tg-theme-text-color)] mb-1">Пока нет курсов</p>
            <p className="text-xs text-[var(--tg-theme-hint-color)] mb-6">Нажмите «+ Добавить», чтобы создать первый курс</p>
            {isTeacher && (
              <button onClick={openCreateForm} className="tg-button text-sm py-2 px-6">
                + Добавить курс
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Floating Action Button (только для admin/owner) ──────────── */}
      {isAdmin && courses.length > 0 && (
        <button
          onClick={() => {
            if (showForm) {
              closeForm();
            } else {
              openCreateForm();
            }
          }}
          className="fixed bottom-20 right-4 z-40 tg-button shadow-lg shadow-[var(--tg-theme-button-color)]/30 rounded-2xl px-5 py-3.5 flex items-center gap-2 text-sm font-semibold animate-slide-up hover:scale-105 active:scale-95 transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {showForm ? 'Закрыть' : 'Добавить'}
        </button>
      )}
    </div>
  );
}
