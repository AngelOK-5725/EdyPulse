import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api, { type Course, type Student } from '../../services/api';

const COLORS = ['#6C5CE7', '#00B894', '#FD79A8', '#FDCB6E', '#0984E3', '#E17055', '#00CEC9', '#636E72'];
const DAYS_OPTIONS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export default function AdminCoursesPage() {
  const { permissions } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [form, setForm] = useState({ title: '', description: '', time: '', price: 0, color: '#6C5CE7', days: [] as string[], location: '', location_link: '' });

  // ── Student management state ──────────────────────────────────────
  const [studentsByCourse, setStudentsByCourse] = useState<Record<string, Student[]>>({});
  const [showStudentsCourseId, setShowStudentsCourseId] = useState<string | null>(null);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollCourseId, setEnrollCourseId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!permissions.canManageUsers) { navigate('/'); return; }
    loadCourses();
  }, [permissions.canManageUsers]);

  const loadCourses = async () => {
    try {
      const data = await api.getCourses();
      setCourses(data.courses);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // ── Load students for a specific course ───────────────────────────
  const loadStudentsForCourse = async (courseId: string) => {
    try {
      const data = await api.getStudents(courseId);
      setStudentsByCourse(prev => ({ ...prev, [courseId]: data.students }));
    } catch (e) { console.error(e); }
  };

  const toggleShowStudents = async (courseId: string) => {
    if (showStudentsCourseId === courseId) {
      setShowStudentsCourseId(null);
      return;
    }
    setShowStudentsCourseId(courseId);
    if (!studentsByCourse[courseId]) {
      await loadStudentsForCourse(courseId);
    }
  };

  // ── Enroll existing student ───────────────────────────────────────
  const handleOpenEnroll = (courseId: string) => {
    setEnrollCourseId(courseId);
    setSearchQuery('');
    setSearchResults([]);
    setShowEnrollModal(true);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.length < 1) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.searchStudents(value);
        // Filter out already enrolled
        const course = courses.find(c => c.id === enrollCourseId);
        const enrolledIds = new Set(
          (course?.student_ids || '').split(',').filter(Boolean)
        );
        setSearchResults(data.students.filter(s => !enrolledIds.has(s.id)));
      } catch (e) {
        console.error('Search failed:', e);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleEnroll = async (studentId: string) => {
    setEnrolling(true);
    try {
      await api.enrollStudent(enrollCourseId, studentId);
      setShowEnrollModal(false);
      await loadCourses();
      if (showStudentsCourseId === enrollCourseId) {
        await loadStudentsForCourse(enrollCourseId);
      }
    } catch (e) {
      console.error('Enroll failed:', e);
      alert('Ошибка при записи');
    } finally {
      setEnrolling(false);
    }
  };

  const handleUnenroll = async (courseId: string, studentId: string) => {
    if (!window.confirm('Отчислить ученика с курса?')) return;
    try {
      await api.unenrollStudent(courseId, studentId);
      await loadCourses();
      await loadStudentsForCourse(courseId);
    } catch (e) {
      console.error('Unenroll failed:', e);
      alert('Ошибка при отчислении');
    }
  };

  const handleCreate = async () => {
    if (!form.title) return;
    try {
      await api.createCourse({ ...form, price: String(form.price), days: form.days.join(',') });
      setShowForm(false);
      setForm({ title: '', description: '', time: '', price: 0, color: '#6C5CE7', days: [], location: '', location_link: '' });
      await loadCourses();
    } catch (e) { console.error(e); }
  };

  const handleUpdate = async () => {
    if (!editingCourse || !form.title) return;
    try {
      await api.updateCourse(editingCourse.id, { ...form, price: String(form.price), days: form.days.join(',') });
      setEditingCourse(null);
      setShowForm(false);
      setForm({ title: '', description: '', time: '', price: 0, color: '#6C5CE7', days: [], location: '', location_link: '' });
      await loadCourses();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Удалить курс?')) return;
    try {
      await api.deleteCourse(id);
      await loadCourses();
    } catch (e) { console.error(e); }
  };

  const startEdit = (course: Course) => {
    setEditingCourse(course);
    setForm({
      title: course.title,
      description: course.description || '',
      time: course.time || '',
      price: parseFloat(course.price) || 0,
      color: course.color || '#6C5CE7',
      days: course.days ? course.days.split(',').filter(Boolean) : [],
      location: course.location || '',
      location_link: course.location_link || '',
    });
    setShowForm(true);
  };

  const toggleDay = (day: string) => {
    setForm(f => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day],
    }));
  };

  if (loading) return <div className="p-4 text-center text-sm text-[var(--tg-theme-hint-color)]">Загрузка...</div>;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/admin')} className="text-sm text-[var(--tg-theme-button-color)] flex items-center gap-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          Назад
        </button>
        <button onClick={() => { setEditingCourse(null); setForm({ title: '', description: '', time: '', price: 0, color: '#6C5CE7', days: [], location: '', location_link: '' }); setShowForm(true); }}
          className="tg-button text-sm py-2 px-4">+ Создать курс</button>
      </div>

      {/* Create/Edit form */}
      {showForm && (
        <div className="tg-card space-y-3 animate-slide-up">
          <h3 className="text-base font-semibold">{editingCourse ? 'Редактировать курс' : 'Новый курс'}</h3>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Название курса" className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 ring-[var(--tg-theme-button-color)]" />
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Описание" className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
          <div className="flex gap-3">
            <input value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
              placeholder="Время (17:00)" className="flex-1 px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
            <input value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
              placeholder="Стоимость" type="number" className="flex-1 px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
          </div>
          {/* Days selector */}
          <div className="flex flex-wrap gap-2">
            {DAYS_OPTIONS.map(day => (
              <button key={day} onClick={() => toggleDay(day)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  form.days.includes(day) ? 'bg-[var(--tg-theme-button-color)] text-white' : 'bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)]'}`}>
                {day}
              </button>
            ))}
          </div>
          {/* Location */}
          <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            placeholder="📍 Адрес (ул. Московская, д. 10)" className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
          <input value={form.location_link} onChange={e => setForm(f => ({ ...f, location_link: e.target.value }))}
            placeholder="🔗 Ссылка на навигатор (Google Maps / Яндекс.Карты)" className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
          {/* Color picker */}
          <div className="flex gap-2">
            {COLORS.map(c => (
              <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                className={`w-8 h-8 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-2 scale-110' : ''}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setEditingCourse(null); }}
              className="tg-button-secondary flex-1 text-sm">Отмена</button>
            <button onClick={editingCourse ? handleUpdate : handleCreate}
              className="tg-button flex-1 text-sm">{editingCourse ? 'Сохранить' : 'Создать'}</button>
          </div>
        </div>
      )}

      {/* Course list */}
      <div className="space-y-2">
        {courses.map(course => (
          <div key={course.id}>
            <div className="tg-card">
              <div className="flex items-center gap-3">
                <div className="w-1 h-12 rounded-full shrink-0" style={{ backgroundColor: course.color }} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold block truncate">{course.title}</span>
                  <span className="text-xs text-[var(--tg-theme-hint-color)]">
                    {course.time} · {course.days} · {course.price} ₽
                  </span>
                  {course.location && (
                    <span className="text-[10px] text-[var(--tg-theme-hint-color)] mt-0.5 block truncate">
                      {course.location_link ? (
                        <a href={course.location_link} target="_blank" rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[var(--tg-theme-button-color)] hover:opacity-80 transition-opacity underline underline-offset-2">
                          📍 {course.location}
                        </a>
                      ) : (
                        <>📍 {course.location}</>
                      )}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(course)}
                    className="p-2 rounded-xl hover:bg-[var(--tg-theme-secondary-bg-color)] text-xs text-[var(--tg-theme-button-color)]">
                    ✏️
                  </button>
                  <button onClick={() => handleDelete(course.id)}
                    className="p-2 rounded-xl hover:bg-red-50 text-xs text-red-500">
                    🗑️
                  </button>
                </div>
              </div>

              {/* Students section */}
              <div className="mt-3 pt-3 border-t border-[var(--tg-theme-section-separator-color)]">
                <button
                  onClick={() => toggleShowStudents(course.id)}
                  className="flex items-center justify-between w-full"
                >
                  <span className="text-xs font-medium text-[var(--tg-theme-hint-color)]">
                    👨‍🎓 Ученики ({course.student_ids ? course.student_ids.split(',').filter(Boolean).length : 0})
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`text-[var(--tg-theme-hint-color)] transition-transform ${
                      showStudentsCourseId === course.id ? 'rotate-180' : ''
                    }`}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {showStudentsCourseId === course.id && (
                  <div className="mt-2 space-y-1.5 animate-slide-up">
                    {(studentsByCourse[course.id] || []).length > 0 ? (
                      (studentsByCourse[course.id] || []).map(s => (
                        <div key={s.id} className="flex items-center gap-2 py-1.5 px-2 rounded-xl hover:bg-[var(--tg-theme-secondary-bg-color)] transition-colors group">
                          <div className="w-6 h-6 rounded-full bg-[var(--tg-theme-button-color)] flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                            {s.first_name?.[0]}{s.last_name?.[0]}
                          </div>
                          <span className="text-xs font-medium flex-1 truncate"
                            onClick={() => navigate(`/student/${s.id}`)}>
                            {s.first_name} {s.last_name}
                          </span>
                          <button
                            onClick={() => handleUnenroll(course.id, s.id)}
                            className="text-[10px] text-red-400 hover:text-red-600 transition-all px-1 ml-auto shrink-0"
                            title="Отчислить"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-2 text-[10px] text-[var(--tg-theme-hint-color)]">
                        Загружается...
                      </div>
                    )}
                    <button
                      onClick={() => handleOpenEnroll(course.id)}
                      className="w-full py-2 rounded-xl bg-[var(--tg-theme-button-color)]/10 text-[11px] font-medium text-[var(--tg-theme-button-color)] hover:bg-[var(--tg-theme-button-color)]/20 transition-all active:scale-[0.98]"
                    >
                      + Добавить ученика
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {courses.length === 0 && (
          <div className="text-center py-8 text-sm text-[var(--tg-theme-hint-color)]">
            Нет курсов. Создайте первый!
          </div>
        )}
      </div>

      {/* ── Enroll Existing Student Modal ───────────────────────────── */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowEnrollModal(false)}>
          <div
            className="w-full max-w-lg bg-[var(--tg-theme-bg-color)] rounded-3xl p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">Записать ученика на курс</h3>
              <button onClick={() => setShowEnrollModal(false)} className="p-1 text-[var(--tg-theme-hint-color)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <input
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="🔍 Введите имя или фамилию..."
              className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]"
              autoFocus
            />

            <div className="mt-3 max-h-60 overflow-y-auto space-y-1">
              {searching && (
                <div className="text-center py-4 text-xs text-[var(--tg-theme-hint-color)]">Поиск...</div>
              )}
              {!searching && searchQuery && searchResults.length === 0 && (
                <div className="text-center py-4 text-xs text-[var(--tg-theme-hint-color)]">Не найдено</div>
              )}
              {!searching && !searchQuery && (
                <div className="text-center py-4 text-xs text-[var(--tg-theme-hint-color)]">Начните вводить имя</div>
              )}
              {searchResults.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleEnroll(s.id)}
                  disabled={enrolling}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--tg-theme-secondary-bg-color)] transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--tg-theme-button-color)] flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {s.first_name?.[0]}{s.last_name?.[0]}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <span className="text-sm font-medium block truncate">{s.first_name} {s.last_name}</span>
                    <span className="text-[10px] text-[var(--tg-theme-hint-color)]">{s.phone || ''}</span>
                  </div>
                  <span className="text-xs font-medium text-green-600 shrink-0">+ Записать</span>
                </button>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowEnrollModal(false)} className="tg-button-secondary flex-1 text-sm">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
