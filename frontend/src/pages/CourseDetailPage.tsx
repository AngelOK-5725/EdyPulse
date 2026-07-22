import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { type Course, type Student, type Payment } from '../services/api';

const COLORS = ['#6C5CE7', '#00B894', '#FD79A8', '#FDCB6E', '#0984E3', '#E17055', '#00CEC9', '#636E72'];
const DAYS_OPTIONS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function getTimeDisplay(item: { start_time?: string; end_time?: string; time?: string }): string {
  const start = item.start_time || item.time || '';
  const end = item.end_time || '';
  if (start && end) {
    return `${start} — ${end}`;
  }
  return start || '—';
}

interface GroupItem {
  id: string;
  course_id: string;
  name: string;
  days: string;
  start_time: string;
  end_time: string;
  location: string;
  location_link: string;
  teacher: string;
  student_ids: string;
  student_count: number;
  is_active: string;
  students?: any[];
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDays(days: string): string {
  if (!days) return '';
  return days.split(',').join(', ');
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const isAdmin = permissions.canManageUsers;

  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'students' | 'groups' | 'payments'>('students');

  // ── Create Group modal state ─────────────────────────────────────────
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupForm, setGroupForm] = useState({
    name: '',
    days: [] as string[],
    start_time: '',
    end_time: '',
    location: '',
    location_link: '',
    teacher: '',
  });

  // ── Edit course state ────────────────────────────────────────────────
  const [showEditCourse, setShowEditCourse] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    time: '',
    price: '',
    monthly_price: '',
    lesson_price: '',
    lessons_per_week: '',
    payment_type: '',
    color: '#6C5CE7',
    days: [] as string[],
    location: '',
    location_link: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const openEditCourse = () => {
    if (!course) return;
    setEditForm({
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
    setShowEditCourse(true);
  };

  const toggleDay = (day: string) => {
    setEditForm(f => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day],
    }));
  };

  const handleEditCourseSave = async () => {
    if (!course || !editForm.title.trim()) return;
    setSavingEdit(true);
    try {
      await api.updateCourse(course.id, {
        title: editForm.title,
        description: editForm.description || undefined,
        time: editForm.time || undefined,
        price: editForm.price,
        monthly_price: editForm.monthly_price || undefined,
        lesson_price: editForm.lesson_price || undefined,
        lessons_per_week: editForm.lessons_per_week || undefined,
        payment_type: editForm.payment_type || undefined,
        color: editForm.color,
        days: editForm.days.join(','),
        location: editForm.location || undefined,
        location_link: editForm.location_link || undefined,
      });
      setShowEditCourse(false);
      // Reload course data
      loadCourse(course.id);
    } catch (e) {
      console.error('Failed to update course:', e);
      alert('Ошибка при сохранении курса');
    } finally {
      setSavingEdit(false);
    }
  };

  useEffect(() => {
    if (!id) {
      setError('Не указан ID курса');
      setLoading(false);
      return;
    }
    loadCourse(id);
  }, [id]);

  const loadCourse = async (courseId: string) => {
    try {
      setLoading(true);
      setError(null);

      const [courseData, studentsData, groupsData, paymentsData] = await Promise.all([
        api.getCourse(courseId),
        api.getStudents(courseId),
        api.getCourseGroups(courseId).catch(() => ({ groups: [] })),
        api.getPayments().catch(() => ({ payments: [] })),
      ]);

      setCourse(courseData);
      setStudents(studentsData.students || []);
      setGroups(groupsData.groups || []);
      setPayments((paymentsData.payments || []).filter((p: Payment) => p.course_id === courseId));
    } catch (e) {
      console.error('CourseDetailPage: Failed to load course:', e);
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────

  const studentCount = students.length;
  const activeStudents = students.filter(s => s.is_active !== 'false').length;
  const groupCount = groups.length;
  const totalPaid = useMemo(() => {
    return payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  }, [payments]);

  const toggleGroupDay = (day: string) => {
    setGroupForm(f => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day],
    }));
  };

  const handleCreateGroup = async () => {
    if (!course || !groupForm.name.trim() || !groupForm.start_time) return;
    setSavingGroup(true);
    try {
      await api.createGroup({
        course_id: course.id,
        name: groupForm.name,
        days: groupForm.days,
        start_time: groupForm.start_time,
        end_time: groupForm.end_time,
        location: groupForm.location || undefined,
        location_link: groupForm.location_link || undefined,
        teacher: groupForm.teacher || undefined,
      });
      setShowGroupForm(false);
      setGroupForm({ name: '', days: [], start_time: '', end_time: '', location: '', location_link: '', teacher: '' });
      await loadCourse(course.id);
    } catch (e) {
      console.error('Failed to create group:', e);
      alert('Ошибка при создании группы');
    } finally {
      setSavingGroup(false);
    }
  };

  // ── Loading state ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-4 space-y-4 animate-fade-in">
        <div className="skeleton h-6 w-20 mb-2" />
        <div className="skeleton h-40 w-full rounded-3xl" />
        <div className="skeleton h-20 w-full rounded-2xl" />
        <div className="skeleton h-48 w-full rounded-2xl" />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────

  if (error || !course) {
    return (
      <div className="p-4 animate-fade-in min-h-full flex flex-col items-center justify-center">
        <div className="tg-card flex flex-col items-center py-12 px-6 text-center max-w-sm mx-auto">
          <span className="text-6xl mb-5">😔</span>
          <h2 className="text-lg font-semibold text-[var(--tg-theme-text-color)] mb-2">
            Курс не найден
          </h2>
          <p className="text-sm text-[var(--tg-theme-hint-color)] leading-relaxed">
            {error || 'Такого курса не существует или у вас нет доступа'}
          </p>
          <button
            onClick={() => navigate('/school/courses')}
            className="mt-6 tg-button text-sm flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Назад к курсам
          </button>
        </div>
      </div>
    );
  }

  const courseColor = course.color || '#6C5CE7';

  return (
    <div className="p-4 space-y-4 animate-fade-in pb-24">
      {/* ── Back button ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/school/courses')}
          className="text-sm text-[var(--tg-theme-button-color)] flex items-center gap-1 hover:opacity-80 transition-opacity"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Назад
        </button>
        {permissions.canEditStudents && (
          <button onClick={openEditCourse}
            className="text-xs px-2.5 py-1 rounded-full font-medium border flex items-center gap-1 hover:bg-[var(--tg-theme-button-color)]/10 transition-colors">
            ✏️ Редактировать курс
          </button>
        )}
      </div>

      {/* ── Course Hero ──────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lg"
        style={{ backgroundColor: courseColor }}
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/5" />

        <div className="relative">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold truncate">{course.title}</h1>
              {course.description && (
                <p className="text-sm text-white/80 mt-1 line-clamp-2">{course.description}</p>
              )}
            </div>
            <div className="text-right shrink-0 ml-3">
              <span className="text-3xl font-bold">{studentCount}</span>
              <p className="text-[10px] text-white/70">учеников</p>
            </div>
          </div>

          {/* Details row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4">
            {course.days && (
              <div className="flex items-center gap-1.5 text-xs text-white/80">
                <span>📅</span>
                <span>{formatDays(course.days)}</span>
              </div>
            )}
            {course.time && (
              <div className="flex items-center gap-1.5 text-xs text-white/80">
                <span>⏰</span>
                <span>{course.time}</span>
              </div>
            )}
            {course.lessons_per_week && (
              <div className="flex items-center gap-1.5 text-xs text-white/80">
                <span>📋</span>
                <span>{course.lessons_per_week} з./нед</span>
              </div>
            )}
          </div>

          {/* Price */}
          {course.price && (
            <div className="mt-3 pt-3 border-t border-white/20">
              <span className="text-lg font-bold">
                {parseFloat(course.price).toLocaleString()} ₸
              </span>
              {course.monthly_price && (
                <span className="text-xs text-white/70 ml-2">
                  / {parseFloat(course.monthly_price).toLocaleString()} ₸ абонемент
                </span>
              )}
              {course.lesson_price && (
                <span className="text-xs text-white/60 ml-2">
                  разово: {parseFloat(course.lesson_price).toLocaleString()} ₸
                </span>
              )}
            </div>
          )}

          {/* Location */}
          {course.location && (
            <div className="mt-2 pt-2 border-t border-white/20">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">📍</span>
                {course.location_link ? (
                  <a
                    href={course.location_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-xs underline underline-offset-2 hover:opacity-80 transition-opacity"
                  >
                    {course.location}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="inline ml-0.5 -mt-0.5">
                      <path d="M7 17L17 7" /><path d="M7 7h10v10" />
                    </svg>
                  </a>
                ) : (
                  <span className="text-xs text-white/80">{course.location}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="tg-card text-center py-3">
          <span className="text-xl font-bold text-[var(--tg-theme-text-color)]">{activeStudents}</span>
          <p className="text-[10px] text-[var(--tg-theme-hint-color)] mt-0.5">Активных</p>
        </div>
        <div className="tg-card text-center py-3">
          <span className="text-xl font-bold text-[var(--tg-theme-text-color)]">{groupCount}</span>
          <p className="text-[10px] text-[var(--tg-theme-hint-color)] mt-0.5">Групп</p>
        </div>
        <div className="tg-card text-center py-3">
          <span className="text-xl font-bold text-green-600">{totalPaid.toLocaleString()} ₸</span>
          <p className="text-[10px] text-[var(--tg-theme-hint-color)] mt-0.5">Оплат</p>
        </div>
      </div>

      {/* ── Quick actions ────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowGroupForm(true)}
          className="tg-button flex-1 text-sm py-3 flex items-center justify-center gap-2"
        >
          ➕ Новая группа
        </button>
        {isAdmin && (
          <button
            onClick={() => navigate('/school/students')}
            className="tg-button-secondary flex-1 text-sm py-3 flex items-center justify-center gap-2"
          >
            👨‍🎓 Ученики
          </button>
        )}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-0.5 rounded-xl bg-[var(--tg-theme-secondary-bg-color)]">
        {[
          { key: 'students' as const, label: '👨‍🎓 Ученики', count: studentCount },
          { key: 'groups' as const, label: '🏫 Группы', count: groupCount },
          { key: 'payments' as const, label: '💳 Оплаты', count: payments.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-[var(--tg-theme-bg-color)] text-[var(--tg-theme-text-color)] shadow-sm'
                : 'text-[var(--tg-theme-hint-color)] hover:opacity-70'
            }`}
          >
            {tab.label} {tab.count > 0 && `(${tab.count})`}
          </button>
        ))}
      </div>

      {/* ── Tab Content: Students ────────────────────────────────────── */}
      {activeTab === 'students' && (
        <div className="space-y-1.5">
          {students.length === 0 ? (
            <div className="tg-card flex flex-col items-center py-8 text-center">
              <span className="text-4xl mb-3">👨‍🎓</span>
              <p className="text-sm text-[var(--tg-theme-hint-color)]">Нет учеников на этом курсе</p>
            </div>
          ) : (
            students.map(student => {
              const isActive = student.is_active !== 'false';
              return (
                <button
                  key={student.id}
                  onClick={() => navigate(`/student/${student.id}`)}
                  className="w-full text-left tg-card group hover:shadow-md transition-all duration-200 active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0 ${
                      isActive
                        ? 'bg-gradient-to-br from-[var(--tg-theme-button-color)] to-[var(--tg-theme-button-color)]/70 text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}>
                      {student.first_name?.[0] || '?'}{student.last_name?.[0] || ''}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-semibold truncate block ${isActive ? 'text-[var(--tg-theme-text-color)]' : 'text-gray-400'}`}>
                        {student.first_name} {student.last_name}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        {student.age && (
                          <span className="text-[10px] text-[var(--tg-theme-hint-color)]">🎂 {student.age}</span>
                        )}
                        {student.phone && (
                          <span className="text-[10px] text-[var(--tg-theme-hint-color)]">📞 {student.phone}</span>
                        )}
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className="text-[var(--tg-theme-hint-color)] shrink-0 group-hover:translate-x-0.5 transition-transform">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* ── Tab Content: Groups ───────────────────────────────────────── */}
      {activeTab === 'groups' && (
        <div className="space-y-2">
          {/* Create Group Form (inline) */}
          {showGroupForm && (
            <div className="tg-card space-y-3 animate-slide-up">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[var(--tg-theme-text-color)]">
                  ➕ Новая группа
                </h3>
                <button onClick={() => setShowGroupForm(false)}
                  className="w-7 h-7 rounded-full bg-[var(--tg-theme-secondary-bg-color)] flex items-center justify-center text-xs hover:opacity-70">✕</button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">Название группы *</label>
                <input value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Робототехника Junior A"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">🕐 Начало *</label>
                  <input type="time" value={groupForm.start_time} onChange={e => setGroupForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">⏰ Конец</label>
                  <input type="time" value={groupForm.end_time} onChange={e => setGroupForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-2">📅 Дни недели</p>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OPTIONS.map(day => (
                    <button key={day} onClick={() => toggleGroupDay(day)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        groupForm.days.includes(day)
                          ? 'border-[var(--tg-theme-button-color)] bg-[var(--tg-theme-button-color)] text-white'
                          : 'border-[var(--tg-theme-section-separator-color)] bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)]'
                      }`}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">📍 Место / Адрес</label>
                <input value={groupForm.location} onChange={e => setGroupForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="ул. Московская, д. 10, каб. 301"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">🔗 Ссылка на карты</label>
                <input value={groupForm.location_link} onChange={e => setGroupForm(f => ({ ...f, location_link: e.target.value }))}
                  placeholder="https://yandex.ru/maps/..."
                  className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">👨‍🏫 Преподаватель</label>
                <input value={groupForm.teacher} onChange={e => setGroupForm(f => ({ ...f, teacher: e.target.value }))}
                  placeholder="Иванова М. С."
                  className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowGroupForm(false)} className="tg-button-secondary flex-1 text-sm">Отмена</button>
                <button onClick={handleCreateGroup}
                  disabled={savingGroup || !groupForm.name.trim() || !groupForm.start_time}
                  className="tg-button flex-1 text-sm disabled:opacity-50">
                  {savingGroup ? '⏳ Создание...' : '✅ Создать группу'}
                </button>
              </div>
            </div>
          )}

          {groups.length === 0 && !showGroupForm ? (
            <div className="tg-card flex flex-col items-center py-8 text-center">
              <span className="text-4xl mb-3">🏫</span>
              <p className="text-sm text-[var(--tg-theme-hint-color)] mb-3">Пока нет групп по этому курсу</p>
              <button onClick={() => setShowGroupForm(true)} className="tg-button text-sm py-2 px-4">
                ➕ Создать группу
              </button>
            </div>
          ) : (
            groups.map(group => {
              const studentIds = group.student_ids ? group.student_ids.split(',').filter(Boolean) : [];
              return (
                <div key={group.id}
                  className="tg-card group hover:shadow-md transition-all duration-200 cursor-pointer active:scale-[0.98]"
                  onClick={() => navigate(`/school/lessons?course_id=${group.course_id}&group_id=${group.id}`)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[var(--tg-theme-button-color)] to-[var(--tg-theme-button-color)]/70 flex items-center justify-center text-white text-lg shrink-0">
                      🏫
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--tg-theme-text-color)] truncate">
                          {group.name}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1">
                        {group.days && (
                          <span className="text-[11px] text-[var(--tg-theme-hint-color)]">
                            📅 {formatDays(group.days)}
                          </span>
                        )}
                        {group.start_time && (
                          <span className="text-[11px] text-[var(--tg-theme-hint-color)]">
                            ⏰ {group.start_time}{group.end_time ? `—${group.end_time}` : ''}
                          </span>
                        )}
                        <span className="text-[11px] text-[var(--tg-theme-hint-color)]">
                          👨‍🎓 {group.student_count || studentIds.length || 0}
                        </span>
                      </div>
                      {group.teacher && (
                        <p className="text-[10px] text-[var(--tg-theme-hint-color)] mt-0.5">
                          👨‍🏫 {group.teacher}
                        </p>
                      )}
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className="text-[var(--tg-theme-hint-color)] shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Tab Content: Payments ─────────────────────────────────────── */}
      {activeTab === 'payments' && (
        <div className="space-y-1.5">
          {payments.length === 0 ? (
            <div className="tg-card flex flex-col items-center py-8 text-center">
              <span className="text-4xl mb-3">💳</span>
              <p className="text-sm text-[var(--tg-theme-hint-color)]">Пока нет платежей по этому курсу</p>
            </div>
          ) : (
            <>
              <div className="tg-card !py-3 !px-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[var(--tg-theme-text-color)]">Всего получено</span>
                  <span className="text-lg font-bold text-green-600">{totalPaid.toLocaleString()} ₸</span>
                </div>
              </div>
              {payments
                .sort((a, b) => b.payment_date.localeCompare(a.payment_date))
                .map(payment => {
                  const student = students.find(s => s.id === payment.student_id);
                  return (
                    <div key={payment.id} className="tg-card !py-3 !px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-[var(--tg-theme-text-color)] block truncate">
                            {student ? `${student.first_name} ${student.last_name}` : 'Ученик удалён'}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-[var(--tg-theme-hint-color)]">
                              {formatDate(payment.payment_date)}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                              payment.payment_type === 'monthly' ? 'bg-blue-50 text-blue-600' :
                              payment.payment_type === 'partial' ? 'bg-amber-50 text-amber-600' :
                              payment.payment_type === 'full' ? 'bg-green-50 text-green-600' :
                              'bg-gray-50 text-gray-600'
                            }`}>
                              {payment.payment_type === 'monthly' ? 'Абонемент' :
                               payment.payment_type === 'partial' ? 'Частично' :
                               payment.payment_type === 'full' ? 'Полностью' :
                               payment.payment_type === 'per_lesson' ? 'Разовое' :
                               payment.payment_type || '—'}
                            </span>
                          </div>
                          {payment.comment && (
                            <p className="text-[10px] text-[var(--tg-theme-hint-color)] mt-0.5 truncate">{payment.comment}</p>
                          )}
                        </div>
                        <span className="text-sm font-bold text-green-600 shrink-0 ml-3">
                          +{parseFloat(payment.amount).toLocaleString()} ₸
                        </span>
                      </div>
                    </div>
                  );
                })}
            </>
          )}
        </div>
      )}
      {/* ── Edit Course Modal ────────────────────────────────────────── */}
      {showEditCourse && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowEditCourse(false)}>
          <div className="w-full max-w-lg bg-[var(--tg-theme-bg-color)] rounded-3xl p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold">✏️ Редактировать курс</h3>
              <button onClick={() => setShowEditCourse(false)} className="p-1 text-[var(--tg-theme-hint-color)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">Название курса *</label>
                <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Робототехника Junior"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">Описание</label>
                <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Основы робототехники для начинающих"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
              </div>

              {/* Time + Price row */}
              <div className="flex gap-3">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">⏰ Время</label>
                  <input value={editForm.time} onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))}
                    placeholder="17:00"
                    className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">💰 Цена (₸)</label>
                  <input value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="40000" type="number"
                    className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
                </div>
              </div>

              {/* Tariff fields */}
              <div className="flex gap-3">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">📅 Абонемент (₸)</label>
                  <input value={editForm.monthly_price} onChange={e => setEditForm(f => ({ ...f, monthly_price: e.target.value }))}
                    placeholder="40000" type="number"
                    className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">🎫 Разовое (₸)</label>
                  <input value={editForm.lesson_price} onChange={e => setEditForm(f => ({ ...f, lesson_price: e.target.value }))}
                    placeholder="5000" type="number"
                    className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">📋 Занятий/нед</label>
                  <input value={editForm.lessons_per_week} onChange={e => setEditForm(f => ({ ...f, lessons_per_week: e.target.value }))}
                    placeholder="2" type="number"
                    className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
                </div>
              </div>

              {/* Days selector */}
              <div>
                <p className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-2">📅 Дни недели</p>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OPTIONS.map(day => (
                    <button key={day} onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        editForm.days.includes(day)
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
                <input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="ул. Московская, д. 10"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">🔗 Ссылка на карты</label>
                <input value={editForm.location_link} onChange={e => setEditForm(f => ({ ...f, location_link: e.target.value }))}
                  placeholder="https://yandex.ru/maps/..."
                  className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
              </div>

              {/* Color picker */}
              <div>
                <p className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-2">🎨 Цвет</p>
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setEditForm(f => ({ ...f, color: c }))}
                      className={`w-8 h-8 rounded-full transition-all ${editForm.color === c ? 'ring-2 ring-offset-2 ring-[var(--tg-theme-button-color)] scale-110' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowEditCourse(false)} className="tg-button-secondary flex-1 text-sm">Отмена</button>
                <button onClick={handleEditCourseSave} disabled={savingEdit || !editForm.title.trim()}
                  className="tg-button flex-1 text-sm disabled:opacity-50">
                  {savingEdit ? '💾 Сохранение...' : '✅ Сохранить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
