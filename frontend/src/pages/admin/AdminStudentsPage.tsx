import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api, { type Student, type Course } from '../../services/api';

export default function AdminStudentsPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({ first_name: '', last_name: '', age: '', phone: '', parent_contact: '', parent_name: '', parent_relation: '', course_ids: [] as string[] });

  // ── Enroll modal state ────────────────────────────────────────────
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollStudentId, setEnrollStudentId] = useState<string>('');
  const [enrollStudentName, setEnrollStudentName] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const loadData = async () => {
    try {
      const [sData, cData] = await Promise.all([api.getStudents(), api.getCourses()]);
      setStudents(sData.students);
      setCourses(cData.courses);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // ── Enroll modal handlers ──────────────────────────────────────────
  const openEnrollModal = (student: Student) => {
    setEnrollStudentId(student.id);
    setEnrollStudentName(`${student.first_name} ${student.last_name}`);
    setShowEnrollModal(true);
  };

  const handleEnroll = async (courseId: string) => {
    setEnrolling(true);
    try {
      await api.enrollStudent(courseId, enrollStudentId);
      setShowEnrollModal(false);
      await loadData();
    } catch (e) {
      console.error('Enroll failed:', e);
      alert('Ошибка при записи на курс');
    } finally {
      setEnrolling(false);
    }
  };

  const handleCreate = async () => {
    if (!form.first_name || !form.last_name) return;
    try {
      await api.createStudent({
        ...form,
        age: form.age || undefined,
        course_ids: form.course_ids.join(','),
      });
      setShowForm(false);
      setForm({ first_name: '', last_name: '', age: '', phone: '', parent_contact: '', parent_name: '', parent_relation: '', course_ids: [] });
      await loadData();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Удалить ученика?')) return;
    try {
      await api.deleteStudent(id);
      await loadData();
    } catch (e) { console.error(e); }
  };

  const openCard = (studentId: string) => {
    navigate(`/student/${studentId}`);
  };

  if (loading) return <div className="p-4 text-center text-sm text-[var(--tg-theme-hint-color)]">Загрузка...</div>;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/admin')} className="text-sm text-[var(--tg-theme-button-color)] flex items-center gap-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          Назад
        </button>
        <button onClick={() => setShowForm(true)} className="tg-button text-sm py-2 px-4">+ Добавить</button>
      </div>

      {showForm && (
        <div className="tg-card space-y-3 animate-slide-up">
          <h3 className="text-base font-semibold">Новый ученик</h3>
          <div className="flex gap-2">
            <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
              placeholder="Имя" className="flex-1 px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
            <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
              placeholder="Фамилия" className="flex-1 px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
          </div>
          <input value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
            placeholder="Возраст" type="number" className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
          <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="Телефон" className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
          <div className="flex gap-2">
            <select value={form.parent_relation} onChange={e => setForm(f => ({ ...f, parent_relation: e.target.value }))}
              className="w-1/3 px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none">
              <option value="">Кто</option>
              <option value="Мама">Мама</option>
              <option value="Папа">Папа</option>
              <option value="Бабушка">Бабушка</option>
              <option value="Дедушка">Дедушка</option>
              <option value="Тетя">Тетя</option>
              <option value="Дядя">Дядя</option>
              <option value="Опекун">Опекун</option>
            </select>
            <input value={form.parent_name} onChange={e => setForm(f => ({ ...f, parent_name: e.target.value }))}
              placeholder="Имя родителя" className="flex-1 px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
          </div>
          <input value={form.parent_contact} onChange={e => setForm(f => ({ ...f, parent_contact: e.target.value }))}
            placeholder="Телефон родителя" className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
          <select multiple value={form.course_ids} onChange={e => setForm(f => ({ ...f, course_ids: Array.from(e.target.selectedOptions, o => o.value) }))}
            className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none">
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="tg-button-secondary flex-1 text-sm">Отмена</button>
            <button onClick={handleCreate} className="tg-button flex-1 text-sm">Создать</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {students.map(s => (
          <div key={s.id} className="tg-card group">
            <div className="flex items-center gap-3">
              <button onClick={() => openCard(s.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <div className="w-10 h-10 rounded-full bg-[var(--tg-theme-secondary-bg-color)] flex items-center justify-center text-sm font-bold shrink-0">
                  {s.first_name[0]}{s.last_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium block truncate">{s.first_name} {s.last_name}</span>
                  <span className="text-xs text-[var(--tg-theme-hint-color)]">{s.age ? `${s.age} лет` : ''} {s.phone ? `· ${s.phone}` : ''}</span>
                </div>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); openEnrollModal(s); }}
                className="shrink-0 px-2.5 py-1.5 rounded-xl bg-[var(--tg-theme-button-color)]/10 text-[10px] font-medium text-[var(--tg-theme-button-color)] hover:bg-[var(--tg-theme-button-color)]/20 transition-all"
                title="Записать на курс"
              >
                + Курс
              </button>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--tg-theme-hint-color)] shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </div>
        ))}
        {students.length === 0 && (
          <div className="text-center py-8 text-sm text-[var(--tg-theme-hint-color)]">Нет учеников</div>
        )}
      </div>

      {/* ── Enroll Modal ──────────────────────────────────────────────── */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowEnrollModal(false)}>
          <div
            className="w-full max-w-sm bg-[var(--tg-theme-bg-color)] rounded-3xl p-6 shadow-2xl animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">📚 Записать на курс</h3>
              <button onClick={() => setShowEnrollModal(false)} className="p-1 text-[var(--tg-theme-hint-color)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <p className="text-sm font-medium mb-4">
              {enrollStudentName}
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {courses.filter(c => {
                const enrolledIds = c.student_ids ? c.student_ids.split(',').filter(Boolean) : [];
                return !enrolledIds.includes(enrollStudentId);
              }).map(c => (
                <button
                  key={c.id}
                  onClick={() => handleEnroll(c.id)}
                  disabled={enrolling}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] hover:opacity-80 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  <div className="flex-1 text-left min-w-0">
                    <span className="text-sm font-medium block truncate">{c.title}</span>
                    <span className="text-[10px] text-[var(--tg-theme-hint-color)]">{c.time} · {c.days}</span>
                  </div>
                  <span className="text-xs font-medium text-green-600 shrink-0">+ Записать</span>
                </button>
              ))}
              {courses.filter(c => {
                const enrolledIds = c.student_ids ? c.student_ids.split(',').filter(Boolean) : [];
                return !enrolledIds.includes(enrollStudentId);
              }).length === 0 && (
                <div className="text-center py-4 text-xs text-[var(--tg-theme-hint-color)]">
                  Ученик уже записан на все курсы
                </div>
              )}
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
