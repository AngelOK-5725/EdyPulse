import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import api, { type Student, type Course } from '../services/api';

const RELATION_OPTIONS = ['Мама', 'Папа', 'Бабушка', 'Дедушка', 'Тетя', 'Дядя', 'Опекун'];

export default function StudentsPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Create form state ─────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    age: '',
    phone: '',
    parent_contact: '',
    parent_name: '',
    parent_relation: '',
    course_ids: [] as string[],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sData, cData] = await Promise.all([api.getStudents(), api.getCourses()]);
      setStudents(sData.students);
      setCourses(cData.courses);
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Local search filter ────────────────────────────────────────────────
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter(s =>
      s.first_name.toLowerCase().includes(q) ||
      s.last_name.toLowerCase().includes(q) ||
      (s.phone && s.phone.includes(q)) ||
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  // ── Get course count for a student ─────────────────────────────────────
  const getCourseCount = (student: Student): number => {
    if (!student.course_ids) return 0;
    return student.course_ids.split(',').filter(Boolean).length;
  };

  // ── Create student ────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.first_name || !form.last_name) return;
    setSaving(true);
    try {
      await api.createStudent({
        ...form,
        age: form.age || undefined,
        course_ids: form.course_ids.join(','),
      });
      setShowForm(false);
      setForm({ first_name: '', last_name: '', age: '', phone: '', parent_contact: '', parent_name: '', parent_relation: '', course_ids: [] });
      await loadData();
    } catch (e) {
      console.error('Failed to create student:', e);
      alert('Ошибка при создании ученика');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 space-y-4 animate-fade-in">
        <div className="skeleton h-8 w-32 mb-1" />
        <div className="skeleton h-10 w-full rounded-2xl mb-2" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="skeleton h-20 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in pb-24">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tg-theme-text-color)]">
            👨‍🎓 Ученики
          </h1>
          <p className="text-xs text-[var(--tg-theme-hint-color)] mt-0.5">
            {students.length} {students.length === 1 ? 'ученик' : students.length < 5 ? 'ученика' : 'учеников'}
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
          placeholder="🔍 Поиск ученика..."
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

      {/* ── Create form (inline) ─────────────────────────────────────── */}
      {showForm && (
        <div className="tg-card space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[var(--tg-theme-text-color)]">✏️ Новый ученик</h3>
            <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-full bg-[var(--tg-theme-secondary-bg-color)] flex items-center justify-center text-xs hover:opacity-70 transition-opacity">✕</button>
          </div>

          <div className="flex gap-2">
            <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
              placeholder="Имя *" className="flex-1 px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
            <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
              placeholder="Фамилия *" className="flex-1 px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
          </div>

          <div className="flex gap-2">
            <input value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
              placeholder="Возраст" type="number" className="w-1/3 px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="Телефон" className="flex-1 px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
          </div>

          <div className="flex gap-2">
            <select value={form.parent_relation} onChange={e => setForm(f => ({ ...f, parent_relation: e.target.value }))}
              className="w-2/5 px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30">
              <option value="">Кто</option>
              {RELATION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input value={form.parent_name} onChange={e => setForm(f => ({ ...f, parent_name: e.target.value }))}
              placeholder="Имя родителя" className="flex-1 px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
          </div>

          <input value={form.parent_contact} onChange={e => setForm(f => ({ ...f, parent_contact: e.target.value }))}
            placeholder="Телефон родителя" className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />

          {/* Course selection */}
          {courses.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-2">📚 Курсы</p>
              <div className="flex flex-wrap gap-1.5">
                {courses.map(c => {
                  const selected = form.course_ids.includes(c.id);
                  return (
                    <button key={c.id} onClick={() => {
                      setForm(f => ({
                        ...f,
                        course_ids: selected ? f.course_ids.filter(x => x !== c.id) : [...f.course_ids, c.id],
                      }));
                    }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        selected
                          ? 'border-[var(--tg-theme-button-color)] bg-[var(--tg-theme-button-color)] text-white'
                          : 'border-[var(--tg-theme-section-separator-color)] bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)]'
                      }`}>
                      {c.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowForm(false)} className="tg-button-secondary flex-1 text-sm">Отмена</button>
            <button onClick={handleCreate} disabled={!form.first_name || !form.last_name || saving}
              className="tg-button flex-1 text-sm disabled:opacity-50">
              {saving ? '⏳ Создание...' : '✓ Создать'}
            </button>
          </div>
        </div>
      )}

      {/* ── Student list ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        {filteredStudents.map(student => {
          const courseCount = getCourseCount(student);
          const initials = (student.first_name?.[0] || '') + (student.last_name?.[0] || '');
          const isActive = student.is_active !== 'false';

          return (
            <button
              key={student.id}
              onClick={() => navigate(`/student/${student.id}`)}
              className="w-full text-left tg-card group hover:shadow-md transition-all duration-200 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3.5">
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold shrink-0 transition-transform group-hover:scale-105 ${
                  isActive
                    ? 'bg-gradient-to-br from-[var(--tg-theme-button-color)] to-[var(--tg-theme-button-color)]/70 text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}>
                  {student.photo_url ? (
                    <img src={student.photo_url} alt="" className="w-full h-full rounded-2xl object-cover" />
                  ) : (
                    initials || '?'
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold truncate ${isActive ? 'text-[var(--tg-theme-text-color)]' : 'text-gray-400'}`}>
                      {student.first_name} {student.last_name}
                    </span>
                    {!isActive && (
                      <span className="text-[9px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">
                        Архив
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {student.phone && (
                      <span className="text-[11px] text-[var(--tg-theme-hint-color)]">
                        📞 {student.phone}
                      </span>
                    )}
                    {courseCount > 0 && (
                      <span className="text-[11px] text-[var(--tg-theme-hint-color)]">
                        📚 {courseCount} {courseCount === 1 ? 'курс' : courseCount < 5 ? 'курса' : 'курсов'}
                      </span>
                    )}
                    {student.age && (
                      <span className="text-[11px] text-[var(--tg-theme-hint-color)]">
                        🎂 {student.age}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className="text-[var(--tg-theme-hint-color)] shrink-0 group-hover:translate-x-0.5 transition-transform">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </button>
          );
        })}

        {/* Empty states */}
        {filteredStudents.length === 0 && students.length > 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <span className="text-4xl mb-3">🔍</span>
            <p className="text-sm font-medium text-[var(--tg-theme-text-color)] mb-1">Ничего не найдено</p>
            <p className="text-xs text-[var(--tg-theme-hint-color)]">Попробуйте изменить поисковый запрос</p>
          </div>
        )}
        {students.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <span className="text-5xl mb-4">👨‍🎓</span>
            <p className="text-base font-semibold text-[var(--tg-theme-text-color)] mb-1">Пока нет учеников</p>
            <p className="text-xs text-[var(--tg-theme-hint-color)] mb-6">Нажмите «+ Добавить», чтобы создать первого ученика</p>
            <button onClick={() => setShowForm(true)} className="tg-button text-sm py-2 px-6">
              + Добавить ученика
            </button>
          </div>
        )}
      </div>

      {/* ── Floating Action Button ────────────────────────────────────── */}
      {students.length > 0 && (
        <button
          onClick={() => {
            if (showForm) {
              setShowForm(false);
            } else {
              setShowForm(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
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
