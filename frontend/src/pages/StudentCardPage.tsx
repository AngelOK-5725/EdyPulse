import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { type StudentProfile, type Course } from '../services/api';

const STATUS_ICONS: Record<string, { icon: string; label: string; color: string }> = {
  present: { icon: '✅', label: 'Был', color: 'text-green-600 bg-green-50 border-green-200' },
  late: { icon: '⏰', label: 'Опоздал', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  absent: { icon: '❌', label: 'Не был', color: 'text-red-600 bg-red-50 border-red-200' },
};

const RELATION_OPTIONS = ['Мама', 'Папа', 'Бабушка', 'Дедушка', 'Тетя', 'Дядя', 'Опекун'];

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  monthly: 'Месяц',
  multi_month: 'Несколько месяцев',
  single_lesson: 'Разовое занятие',
  partial: 'Частичная оплата',
  full: 'Произвольная сумма',
};

export default function StudentCardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);

  // ── Edit mode state ───────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    age: '',
    birth_date: '',
    phone: '',
    telegram: '',
    parent_contact: '',
    parent_name: '',
    parent_relation: '',
    photo_url: '',
  });
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);

  // ── Payment modal state ────────────────────────────────────────────
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_type: 'monthly' as string,
    course_id: '',
    comment: '',
  });

  // ── Photo modal ───────────────────────────────────────────────────
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  // ── Photo upload ref ──────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    loadProfile(id);
  }, [id]);

  const loadProfile = async (studentId: string) => {
    try {
      setLoading(true);
      const data = await api.getStudentProfile(studentId);
      setProfile(data);
      setError(null);
    } catch (e) {
      console.error('Failed to load student profile:', e);
      setError('Не удалось загрузить данные ученика');
    } finally {
      setLoading(false);
    }
  };

  // ── Payment modal helpers ───────────────────────────────────────────

  const openPaymentModal = () => {
    if (!profile || !profile.courses.length) return;

    // Default to the first course
    const firstCourse = profile.courses[0];
    const monthlyPrice = parseFloat(firstCourse.monthly_price || firstCourse.price) || 0;

    setPaymentForm({
      amount: String(monthlyPrice),
      payment_date: new Date().toISOString().split('T')[0],
      payment_type: 'monthly',
      course_id: firstCourse.id,
      comment: '',
    });
    setShowPaymentModal(true);
  };

  const handlePaymentTypeChange = (type: string) => {
    if (!profile) return;

    const selectedCourse = profile.courses.find(c => c.id === paymentForm.course_id);
    const monthlyPrice = parseFloat(selectedCourse?.monthly_price || selectedCourse?.price || '0') || 0;
    const lessonPrice = parseFloat(selectedCourse?.lesson_price || '0') || 0;

    let amount = 0;

    switch (type) {
      case 'monthly':
        amount = monthlyPrice;
        break;
      case 'multi_month':
        amount = monthlyPrice * 3;
        break;
      case 'single_lesson':
        amount = lessonPrice || Math.round(monthlyPrice / 4);
        break;
      case 'partial':
        amount = Math.round(monthlyPrice / 2);
        break;
      case 'full':
        amount = 0;
        break;
    }

    setPaymentForm(f => ({
      ...f,
      payment_type: type,
      amount: amount ? String(amount) : '',
    }));
  };

  const handleSavePayment = async () => {
    if (!id || savingPayment) return;
    setSavingPayment(true);
    try {
      await api.createPayment({
        student_id: id,
        course_id: paymentForm.course_id,
        amount: parseFloat(paymentForm.amount) || 0,
        payment_date: paymentForm.payment_date,
        payment_type: paymentForm.payment_type,
        comment: paymentForm.comment,
      });
      setShowPaymentModal(false);
      await loadProfile(id);
    } catch (e) {
      console.error('Failed to save payment:', e);
      alert('Ошибка при сохранении платежа');
    } finally {
      setSavingPayment(false);
    }
  };

  // ── Edit helpers ────────────────────────────────────────────────────

  const startEditing = async () => {
    if (!profile) return;
    const { student } = profile;
    setEditForm({
      first_name: student.first_name || '',
      last_name: student.last_name || '',
      age: student.age || '',
      birth_date: student.birth_date || '',
      phone: student.phone || '',
      telegram: student.telegram || '',
      parent_contact: student.parent_contact || '',
      parent_name: student.parent_name || '',
      parent_relation: student.parent_relation || '',
      photo_url: student.photo_url || '',
    });
    setSelectedCourseIds(student.course_ids ? student.course_ids.split(',').filter(Boolean) : []);
    try {
      const cData = await api.getCourses();
      setAllCourses(cData.courses);
    } catch (e) { console.error(e); }
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditForm({
      first_name: '', last_name: '', age: '', birth_date: '',
      phone: '', telegram: '', parent_contact: '', parent_name: '',
      parent_relation: '', photo_url: '',
    });
  };

  const saveEdits = async () => {
    if (!profile || !id) return;
    setSaving(true);
    try {
      await api.updateStudent(id, {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        age: editForm.age || undefined,
        birth_date: editForm.birth_date || undefined,
        phone: editForm.phone || undefined,
        telegram: editForm.telegram || undefined,
        parent_contact: editForm.parent_contact || undefined,
        parent_name: editForm.parent_name || undefined,
        parent_relation: editForm.parent_relation || undefined,
        photo_url: editForm.photo_url || undefined,
        course_ids: selectedCourseIds.join(','),
      });
      await loadProfile(id);
      setEditing(false);
    } catch (e) {
      console.error('Failed to save:', e);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setEditForm(f => ({ ...f, photo_url: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/admin/students');
    }
  };

  const formatParentDisplay = () => {
    if (!profile) return null;
    const { student } = profile;
    const relation = student.parent_relation;
    const name = student.parent_name;
    const contact = student.parent_contact;

    if (relation && name) {
      return { relation, name, contact, full: `${relation}: ${name}` };
    }
    if (name) {
      return { relation: '', name, contact, full: name };
    }
    if (contact) {
      return { relation: '', name: '', contact, full: contact };
    }
    return null;
  };

  // ── Loading state ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 space-y-4 animate-fade-in">
        <div className="skeleton h-6 w-24 mb-2" />
        <div className="skeleton h-36 w-full rounded-3xl" />
        <div className="skeleton h-24 w-full rounded-2xl" />
        <div className="skeleton h-40 w-full rounded-2xl" />
        <div className="skeleton h-32 w-full rounded-2xl" />
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────
  if (error || !profile) {
    return (
      <div className="p-4 animate-fade-in">
        <button onClick={handleBack} className="text-sm text-[var(--tg-theme-button-color)] flex items-center gap-1 mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Назад
        </button>
        <div className="tg-card flex flex-col items-center py-8 text-center">
          <span className="text-4xl mb-3">😔</span>
          <p className="text-sm text-[var(--tg-theme-hint-color)] mb-4">{error || 'Ученик не найден'}</p>
          <button onClick={() => id && loadProfile(id)} className="tg-button text-sm">Попробовать снова</button>
        </div>
      </div>
    );
  }

  const { student, courses, payments, total_paid, achievements, attendance } = profile;
  const courseNames = courses.map(c => c.title).join(', ') || '—';
  const initials = (student.first_name?.[0] || '') + (student.last_name?.[0] || '');
  const parentInfo = formatParentDisplay();
  const displayedHistory = showAllHistory ? attendance.history : attendance.history.slice(0, 5);

  // ── RENDER: Edit mode ─────────────────────────────────────────────
  if (editing) {
    return (
      <div className="p-4 space-y-4 animate-fade-in pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={cancelEditing} className="text-sm text-[var(--tg-theme-button-color)] flex items-center gap-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            Отмена
          </button>
          <h2 className="text-base font-semibold text-[var(--tg-theme-text-color)]">Редактирование</h2>
          <button onClick={saveEdits} disabled={saving}
            className="tg-button text-sm py-1.5 px-4 disabled:opacity-50">
            {saving ? '💾' : '✓'} Сохранить
          </button>
        </div>

        {/* Photo preview + upload */}
        <div className="tg-card flex flex-col items-center gap-3">
          <div className="relative">
            {editForm.photo_url ? (
              <img src={editForm.photo_url} alt="" className="w-24 h-24 rounded-2xl object-cover border-2 border-[var(--tg-theme-button-color)]/30 shadow-md" />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-[var(--tg-theme-secondary-bg-color)] flex items-center justify-center text-3xl font-bold text-[var(--tg-theme-hint-color)] border-2 border-dashed border-[var(--tg-theme-hint-color)]/30">
                {editForm.first_name?.[0]}{editForm.last_name?.[0]}
              </div>
            )}
            <button onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[var(--tg-theme-button-color)] text-white flex items-center justify-center shadow-md hover:scale-110 transition-transform">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="text-xs text-[var(--tg-theme-button-color)]">
            Загрузить фото
          </button>
          {editForm.photo_url && (
            <button onClick={() => setEditForm(f => ({ ...f, photo_url: '' }))}
              className="text-xs text-red-500">
              Удалить фото
            </button>
          )}
        </div>

        {/* Name fields */}
        <div className="tg-card space-y-3">
          <h3 className="text-xs font-semibold text-[var(--tg-theme-hint-color)] uppercase tracking-wide">Личные данные</h3>
          <div className="flex gap-2">
            <input value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))}
              placeholder="Имя" className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
            <input value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))}
              placeholder="Фамилия" className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
          </div>
          <div className="flex gap-2">
            <input value={editForm.age} onChange={e => setEditForm(f => ({ ...f, age: e.target.value }))}
              placeholder="Возраст" type="number" className="w-1/3 px-3 py-2.5 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
            <input value={editForm.birth_date} onChange={e => setEditForm(f => ({ ...f, birth_date: e.target.value }))}
              placeholder="Дата рождения" type="date" className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
          </div>
        </div>

        {/* Contact fields */}
        <div className="tg-card space-y-3">
          <h3 className="text-xs font-semibold text-[var(--tg-theme-hint-color)] uppercase tracking-wide">Контакты</h3>
          <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="Телефон ученика" className="w-full px-3 py-2.5 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
          <input value={editForm.telegram} onChange={e => setEditForm(f => ({ ...f, telegram: e.target.value }))}
            placeholder="@telegram" className="w-full px-3 py-2.5 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
        </div>

        {/* Parent fields */}
        <div className="tg-card space-y-3">
          <h3 className="text-xs font-semibold text-[var(--tg-theme-hint-color)] uppercase tracking-wide">👤 Родитель / контактное лицо</h3>
          <div className="flex gap-2">
            <select value={editForm.parent_relation} onChange={e => setEditForm(f => ({ ...f, parent_relation: e.target.value }))}
              className="w-2/5 px-3 py-2.5 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30">
              <option value="">Кто</option>
              {RELATION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input value={editForm.parent_name} onChange={e => setEditForm(f => ({ ...f, parent_name: e.target.value }))}
              placeholder="Имя" className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
          </div>
          <input value={editForm.parent_contact} onChange={e => setEditForm(f => ({ ...f, parent_contact: e.target.value }))}
            placeholder="Телефон родителя" className="w-full px-3 py-2.5 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
        </div>

        {/* Courses */}
        <div className="tg-card space-y-3">
          <h3 className="text-xs font-semibold text-[var(--tg-theme-hint-color)] uppercase tracking-wide">📚 Курсы</h3>
          <div className="flex flex-wrap gap-2">
            {allCourses.map(c => {
              const selected = selectedCourseIds.includes(c.id);
              return (
                <button key={c.id} onClick={() => {
                  setSelectedCourseIds(prev =>
                    selected ? prev.filter(x => x !== c.id) : [...prev, c.id]
                  );
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
      </div>
    );
  }

  // ── RENDER: View mode ─────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4 animate-fade-in pb-24">
      {/* Photo modal overlay */}
      {showPhotoModal && student.photo_url && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowPhotoModal(false)}>
          <div className="relative max-w-sm w-full">
            <img src={student.photo_url} alt=""
              className="w-full rounded-3xl object-cover shadow-2xl" />
            <button onClick={() => setShowPhotoModal(false)}
              className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center text-lg hover:bg-white/30 transition-colors">
              ✕
            </button>
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/70 to-transparent rounded-b-3xl">
              <p className="text-white font-bold text-lg">{student.first_name} {student.last_name}</p>
              {parentInfo && (
                <p className="text-white/70 text-sm mt-0.5">{parentInfo.full}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Payment modal ────────────────────────────────────────────── */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowPaymentModal(false)}>
          <div className="bg-[var(--tg-theme-bg-color)] rounded-3xl w-full max-w-md p-5 pb-8 shadow-2xl animate-slide-up"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[var(--tg-theme-text-color)]">➕ Добавить платеж</h3>
              <button onClick={() => setShowPaymentModal(false)}
                className="w-8 h-8 rounded-full bg-[var(--tg-theme-secondary-bg-color)] flex items-center justify-center text-sm hover:opacity-70 transition-opacity">
                ✕
              </button>
            </div>

            {/* Course selector */}
            {courses.length > 1 && (
              <div className="mb-4">
                <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1.5 block">Курс</label>
                <div className="flex gap-1.5 flex-wrap">
                  {courses.map(c => (
                    <button key={c.id}
                      onClick={() => {
                        const mp = parseFloat(c.monthly_price || c.price) || 0;
                        setPaymentForm(f => ({
                          ...f,
                          course_id: c.id,
                          amount: f.payment_type === 'monthly' ? String(mp) : f.amount,
                        }));
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        paymentForm.course_id === c.id
                          ? 'border-[var(--tg-theme-button-color)] bg-[var(--tg-theme-button-color)] text-white'
                          : 'border-[var(--tg-theme-section-separator-color)] bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)]'
                      }`}>
                      {c.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Payment type */}
            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1.5 block">Тип платежа</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { value: 'monthly', label: '📆 Месяц' },
                  { value: 'multi_month', label: '📚 Несколько месяцев' },
                  { value: 'single_lesson', label: '📖 Разовое занятие' },
                  { value: 'partial', label: '✂️ Частичная' },
                  { value: 'full', label: '📝 Произвольная' },
                ].map(opt => (
                  <button key={opt.value}
                    onClick={() => handlePaymentTypeChange(opt.value)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                      paymentForm.payment_type === opt.value
                        ? 'border-[var(--tg-theme-button-color)] bg-[var(--tg-theme-button-color)]/10 text-[var(--tg-theme-button-color)]'
                        : 'border-[var(--tg-theme-section-separator-color)] bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)]'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1.5 block">Сумма (₸)</label>
              <input type="number" value={paymentForm.amount}
                onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-lg font-bold outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30"
                placeholder="0" />
            </div>



            {/* Date */}
            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1.5 block">Дата платежа</label>
              <input type="date" value={paymentForm.payment_date}
                onChange={e => setPaymentForm(f => ({ ...f, payment_date: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30" />
            </div>

            {/* Comment */}
            <div className="mb-5">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1.5 block">Комментарий</label>
              <input type="text" value={paymentForm.comment}
                onChange={e => setPaymentForm(f => ({ ...f, comment: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30"
                placeholder="Например: оплата за июль" />
            </div>

            {/* Save button */}
            <button onClick={handleSavePayment} disabled={savingPayment || !paymentForm.amount}
              className="w-full tg-button text-base disabled:opacity-50">
              {savingPayment ? '⏳ Сохранение...' : '✓ Сохранить платеж'}
            </button>
          </div>
        </div>
      )}

      {/* ── Back + Edit buttons ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button onClick={handleBack} className="text-sm text-[var(--tg-theme-button-color)] flex items-center gap-1 hover:opacity-80 transition-opacity">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          Назад
        </button>
        {isAdmin && (
          <button onClick={startEditing} className="text-sm text-[var(--tg-theme-button-color)] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--tg-theme-button-color)]/10 hover:bg-[var(--tg-theme-button-color)]/20 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            Редактировать
          </button>
        )}
      </div>

      {/* ── Hero profile card ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--tg-theme-button-color)] to-[var(--tg-theme-button-color)]/70 text-white p-6 shadow-lg">
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-white/5" />

        <div className="relative flex items-center gap-5">
          <button onClick={() => student.photo_url && setShowPhotoModal(true)}
            className={`shrink-0 transition-transform ${student.photo_url ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'cursor-default'}`}>
            {student.photo_url ? (
              <img src={student.photo_url} alt="" className="w-20 h-20 rounded-2xl border-2 border-white/30 object-cover shadow-md" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl font-bold border border-white/20 shadow-md">
                {initials}
              </div>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">
              {student.first_name} {student.last_name}
            </h2>
            <div className="flex flex-wrap gap-2 mt-2">
              {student.age && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm">
                  {student.age} лет
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm">
                {attendance.total_lessons} занятий
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full backdrop-blur-sm ${
                attendance.attendance_rate >= 80 ? 'bg-green-400/30' :
                attendance.attendance_rate >= 50 ? 'bg-amber-400/30' : 'bg-red-400/30'
              }`}>
                {attendance.attendance_rate}% посещ.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick info grid ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="tg-card !p-3 flex items-center gap-3">
          <span className="text-xl">📚</span>
          <div className="min-w-0">
            <p className="text-[10px] text-[var(--tg-theme-hint-color)]">Курсы</p>
            <p className="text-xs font-medium truncate">{courseNames}</p>
          </div>
        </div>
        <div className="tg-card !p-3 flex items-center gap-3">
          <span className="text-xl">{parentInfo?.relation === 'Папа' || parentInfo?.relation === 'Дедушка' || parentInfo?.relation === 'Дядя' ? '👨' : parentInfo?.relation === 'Бабушка' || parentInfo?.relation === 'Тетя' || parentInfo?.relation === 'Мама' ? '👩' : '👤'}</span>
          <div className="min-w-0">
            <p className="text-[10px] text-[var(--tg-theme-hint-color)]">{parentInfo?.relation || 'Родитель'}</p>
            <p className="text-xs font-medium truncate">{parentInfo ? (parentInfo.name || parentInfo.contact || '—') : '—'}</p>
          </div>
        </div>
        <div className="tg-card !p-3 flex items-center gap-3">
          <span className="text-xl">📅</span>
          <div className="min-w-0">
            <p className="text-[10px] text-[var(--tg-theme-hint-color)]">Начало</p>
            <p className="text-xs font-medium">{student.start_date || '—'}</p>
          </div>
        </div>
        <div className="tg-card !p-3 flex items-center gap-3">
          <span className="text-xl">{attendance.last_visit ? '📅' : '—'}</span>
          <div className="min-w-0">
            <p className="text-[10px] text-[var(--tg-theme-hint-color)]">Последний визит</p>
            <p className="text-xs font-medium">{attendance.last_visit || 'Нет данных'}</p>
          </div>
        </div>
      </div>

      {/* ── Contact info ─────────────────────────────────────────────── */}
      {(student.phone || student.telegram || parentInfo) && (
        <div className="tg-card">
          <h3 className="text-sm font-semibold text-[var(--tg-theme-text-color)] mb-3 flex items-center gap-2">
            <span>📱</span> Контакты
          </h3>
          <div className="space-y-2 text-sm">
            {student.phone && (
              <div className="flex items-center gap-2">
                <span className="text-[var(--tg-theme-hint-color)]">📞</span>
                <span>{student.phone}</span>
              </div>
            )}
            {student.telegram && (
              <div className="flex items-center gap-2">
                <span className="text-[var(--tg-theme-hint-color)]">✈️</span>
                <span>{student.telegram}</span>
              </div>
            )}
            {parentInfo && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--tg-theme-hint-color)]">👨‍👩‍👧</span>
                  <span>
                    {parentInfo.relation && <span className="font-medium">{parentInfo.relation}: </span>}
                    {parentInfo.name && <span>{parentInfo.name}</span>}
                  </span>
                </div>
                {parentInfo.contact && (
                  <div className="flex items-center gap-2 ml-6">
                    <span className="text-[var(--tg-theme-hint-color)]">📞</span>
                    <span>{parentInfo.contact}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Payment card ─────────────────────────────────────────────── */}
      <div className="tg-card">
        <h3 className="text-sm font-semibold text-[var(--tg-theme-text-color)] mb-3 flex items-center gap-2">
          <span>💰</span> Оплата
        </h3>

        {/* Total paid summary */}
        <div className="flex items-center justify-between mb-4 px-1">
          <span className="text-sm text-[var(--tg-theme-hint-color)]">Всего оплачено</span>
          <span className="text-xl font-bold text-green-600">
            {total_paid.toLocaleString()} ₸
          </span>
        </div>

        {/* Add payment button */}
        {isAdmin && courses.length > 0 && (
          <button
            onClick={openPaymentModal}
            className="w-full py-3 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] tg-button"
          >
            ➕ Добавить платеж
          </button>
        )}

        {/* Payment journal toggle */}
        {payments.length > 0 && (
          <>
            <button
              onClick={() => setShowAllPayments(!showAllPayments)}
              className="w-full mt-3 py-2 text-xs font-medium text-[var(--tg-theme-button-color)] hover:opacity-80 transition-opacity"
            >
              {showAllPayments ? '▲ Скрыть историю' : `▼ История платежей (${payments.length})`}
            </button>

            {showAllPayments && (
              <div className="mt-2 space-y-1 pt-3 border-t border-[var(--tg-theme-section-separator-color)]">
                {payments.map(p => {
                  const typeLabel = PAYMENT_TYPE_LABELS[p.payment_type] || p.payment_type;
                  const courseName = courses.find(c => c.id === p.course_id)?.title || '';
                  return (
                    <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-[var(--tg-theme-secondary-bg-color)] transition-colors">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs font-mono text-[var(--tg-theme-hint-color)] shrink-0 w-20">
                          {p.payment_date || '—'}
                        </span>
                        <span className="text-sm font-semibold text-green-600 shrink-0">
                          +{parseFloat(p.amount).toLocaleString()} ₸
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-hint-color)] shrink-0">
                          {typeLabel}
                        </span>
                        {courseName && (
                          <span className="text-[10px] text-[var(--tg-theme-hint-color)] truncate">
                            {courseName}
                          </span>
                        )}
                      </div>
                      {p.comment && (
                        <span className="text-[10px] text-[var(--tg-theme-hint-color)] truncate max-w-[80px] ml-2">
                          💬 {p.comment}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {payments.length === 0 && (
          <p className="text-xs text-[var(--tg-theme-hint-color)] text-center pt-3">
            Платежей пока нет. Нажмите «Добавить платеж», чтобы создать первый.
          </p>
        )}
      </div>

      {/* ── Attendance stats card ────────────────────────────────────── */}
      <div className="tg-card">
        <h3 className="text-sm font-semibold text-[var(--tg-theme-text-color)] mb-3 flex items-center gap-2">
          <span>📊</span> Посещаемость
        </h3>

        <div className="flex items-center gap-6 mb-4">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="30" fill="none" stroke="#f0f0f0" strokeWidth="6" />
              <circle
                cx="36" cy="36" r="30" fill="none"
                stroke={attendance.attendance_rate >= 80 ? '#22c55e' : attendance.attendance_rate >= 50 ? '#f59e0b' : '#ef4444'}
                strokeWidth="6"
                strokeDasharray={`${(attendance.attendance_rate / 100) * 188.5} 188.5`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-lg font-bold ${
                attendance.attendance_rate >= 80 ? 'text-green-500' :
                attendance.attendance_rate >= 50 ? 'text-amber-500' : 'text-red-500'
              }`}>
                {attendance.attendance_rate}%
              </span>
            </div>
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1">✅ Присутствовал</span>
              <span className="font-semibold text-green-600">{attendance.present}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1">⏰ Опоздал</span>
              <span className="font-semibold text-amber-600">{attendance.late}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1">❌ Отсутствовал</span>
              <span className="font-semibold text-red-600">{attendance.absent}</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--tg-theme-section-separator-color)]">
              <span className="text-[var(--tg-theme-hint-color)]">Всего отметок</span>
              <span className="font-semibold">{attendance.total_records}</span>
            </div>
          </div>
        </div>

        <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${attendance.total_records > 0 ? (attendance.present / attendance.total_records) * 100 : 0}%` }} />
          <div className="h-full bg-amber-500 transition-all" style={{ width: `${attendance.total_records > 0 ? (attendance.late / attendance.total_records) * 100 : 0}%` }} />
          <div className="h-full bg-red-500 transition-all" style={{ width: `${attendance.total_records > 0 ? (attendance.absent / attendance.total_records) * 100 : 0}%` }} />
        </div>
      </div>

      {/* ── Attendance history ───────────────────────────────────────── */}
      {attendance.history.length > 0 && (
        <div className="tg-card">
          <h3 className="text-sm font-semibold text-[var(--tg-theme-text-color)] mb-3 flex items-center gap-2">
            <span>📋</span> История посещений
          </h3>

          <div className="space-y-1">
            {displayedHistory.map((record) => {
              const statusInfo = STATUS_ICONS[record.status] || STATUS_ICONS.absent;
              const course = courses.find(c => c.id === record.course_id);
              return (
                <div key={record.id} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-[var(--tg-theme-secondary-bg-color)] transition-colors">
                  <span className="text-xs font-mono text-[var(--tg-theme-hint-color)] w-24 shrink-0">
                    {record.date}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusInfo.color}`}>
                    {statusInfo.icon} {statusInfo.label}
                  </span>
                  <span className="text-xs text-[var(--tg-theme-hint-color)] truncate flex-1">
                    {course?.title || record.course_id}
                  </span>
                  {record.comment && (
                    <span className="text-[10px] text-[var(--tg-theme-hint-color)] truncate max-w-[80px]">
                      💬 {record.comment}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {attendance.history.length > 5 && (
            <button
              onClick={() => setShowAllHistory(!showAllHistory)}
              className="w-full mt-2 py-2 text-xs font-medium text-[var(--tg-theme-button-color)] hover:opacity-80 transition-opacity"
            >
              {showAllHistory
                ? '▲ Показать меньше'
                : `▼ Показать все (${attendance.history.length})`}
            </button>
          )}
        </div>
      )}

      {/* ── Achievements ─────────────────────────────────────────────── */}
      <div className="tg-card">
        <h3 className="text-sm font-semibold text-[var(--tg-theme-text-color)] mb-3 flex items-center gap-2">
          <span>🏆</span> Достижения
        </h3>

        {achievements.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {achievements.map(a => (
              <div key={a.id} className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-100">
                <span className="text-xl shrink-0">{a.icon}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-800">{a.title}</p>
                  {a.description && (
                    <p className="text-[10px] text-amber-600 mt-0.5 line-clamp-2">{a.description}</p>
                  )}
                  {a.achieved_at && (
                    <p className="text-[9px] text-amber-400 mt-0.5">{a.achieved_at.split('T')[0]}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-4 text-center">
            <span className="text-2xl mb-1">🌟</span>
            <p className="text-xs text-[var(--tg-theme-hint-color)]">Пока нет достижений</p>
          </div>
        )}
      </div>

      {/* ── Admin: Delete button ─────────────────────────────────────── */}
      {isAdmin && (
        <button
          onClick={async () => {
            if (!window.confirm(`Удалить ученика ${student.first_name} ${student.last_name}?`)) return;
            try {
              await api.deleteStudent(student.id);
              navigate('/admin/students');
            } catch (e) { console.error(e); }
          }}
          className="w-full py-3 rounded-2xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-all active:scale-[0.98]"
        >
          Удалить ученика
        </button>
      )}
    </div>
  );
}
