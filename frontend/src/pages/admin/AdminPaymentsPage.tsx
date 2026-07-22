import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api, { type Payment, type Student, type Course } from '../../services/api';

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  monthly: 'Месяц',
  multi_month: 'Несколько месяцев',
  single_lesson: 'Разовое занятие',
  partial: 'Частичная',
  full: 'Произвольная',
};

export default function AdminPaymentsPage() {
  const { permissions } = useAuth();
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Payment modal state ─────────────────────────────────────────────
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })(),
    payment_type: 'monthly' as string,
    student_id: '',
    course_id: '',
    comment: '',
  });

  useEffect(() => {
    if (!permissions.canManageUsers) { navigate('/'); return; }
    loadData();
  }, [permissions.canManageUsers]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pData, sData, cData] = await Promise.all([
        api.getPayments(),
        api.getStudents(),
        api.getCourses(),
      ]);
      setPayments(pData.payments);
      setStudents(sData.students);
      setCourses(cData.courses);
    } catch (e) {
      console.error('Failed to load payments:', e);
    } finally {
      setLoading(false);
    }
  };

  const getStudentName = (id: string) => {
    const s = students.find(st => st.id === id);
    return s ? `${s.first_name} ${s.last_name}` : id;
  };

  const getCourseTitle = (id: string) => {
    const c = courses.find(co => co.id === id);
    return c?.title || id;
  };

  // ── Payment modal helpers ─────────────────────────────────────────────

  const openPaymentModal = () => {
    const firstStudent = students[0];
    const firstCourse = courses[0];
    const monthlyPrice = parseFloat(firstCourse?.monthly_price || firstCourse?.price || '0') || 0;

    setPaymentForm({
      amount: String(monthlyPrice),
      payment_date: new Date().toISOString().split('T')[0],
      payment_type: 'monthly',
      student_id: firstStudent?.id || '',
      course_id: firstCourse?.id || '',
      comment: '',
    });
    setShowPaymentModal(true);
  };

  const handlePaymentTypeChange = (type: string) => {
    const selectedCourse = courses.find(c => c.id === paymentForm.course_id);
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
    if (savingPayment) return;
    setSavingPayment(true);
    try {
      await api.createPayment({
        student_id: paymentForm.student_id,
        course_id: paymentForm.course_id,
        amount: parseFloat(paymentForm.amount) || 0,
        payment_date: paymentForm.payment_date,
        payment_type: paymentForm.payment_type,
        comment: paymentForm.comment,
      });
      setShowPaymentModal(false);
      await loadData();
    } catch (e) {
      console.error('Failed to save payment:', e);
      alert('Ошибка при сохранении платежа');
    } finally {
      setSavingPayment(false);
    }
  };

  const totalAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
  const paymentsByStudent = new Map<string, number>();
  payments.forEach(p => {
    const sid = p.student_id;
    paymentsByStudent.set(sid, (paymentsByStudent.get(sid) || 0) + 1);
  });

  if (loading) {
    return <div className="p-4 text-center text-sm text-[var(--tg-theme-hint-color)]">Загрузка...</div>;
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* Payment modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowPaymentModal(false)}>
          <div className="bg-[var(--tg-theme-bg-color)] rounded-3xl w-full max-w-md p-5 pb-8 shadow-2xl animate-slide-up"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[var(--tg-theme-text-color)]">➕ Добавить платеж</h3>
              <button onClick={() => setShowPaymentModal(false)}
                className="w-8 h-8 rounded-full bg-[var(--tg-theme-secondary-bg-color)] flex items-center justify-center text-sm hover:opacity-70 transition-opacity">✕</button>
            </div>

            {/* Student selector */}
            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1.5 block">Ученик</label>
              <select value={paymentForm.student_id}
                onChange={e => setPaymentForm(f => ({ ...f, student_id: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30">
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                ))}
              </select>
            </div>

            {/* Course selector */}
            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1.5 block">Курс</label>
              <select value={paymentForm.course_id}
                onChange={e => {
                  const c = courses.find(co => co.id === e.target.value);
                  const mp = parseFloat(c?.monthly_price || c?.price || '0') || 0;
                  setPaymentForm(f => ({
                    ...f,
                    course_id: e.target.value,
                    amount: f.payment_type === 'monthly' ? String(mp) : f.amount,
                  }));
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30">
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

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

            <button onClick={handleSavePayment} disabled={savingPayment || !paymentForm.amount || !paymentForm.student_id}
              className="w-full tg-button text-base disabled:opacity-50">
              {savingPayment ? '⏳ Сохранение...' : '✓ Сохранить платеж'}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/admin')} className="text-sm text-[var(--tg-theme-button-color)] flex items-center gap-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Назад
        </button>
        <h2 className="text-base font-semibold">Журнал платежей</h2>
        <button onClick={openPaymentModal} className="tg-button text-sm py-1.5 px-3 flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Добавить
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-green-50 rounded-2xl p-3 text-center border border-green-100">
          <span className="text-lg">💰</span>
          <p className="text-lg font-bold text-green-600">{payments.length}</p>
          <p className="text-[10px] text-green-500">Платежей</p>
        </div>
        <div className="bg-blue-50 rounded-2xl p-3 text-center border border-blue-100">
          <span className="text-lg">👨‍🎓</span>
          <p className="text-lg font-bold text-blue-600">{paymentsByStudent.size}</p>
          <p className="text-[10px] text-blue-500">Учеников</p>
        </div>
        <div className="bg-amber-50 rounded-2xl p-3 text-center border border-amber-100">
          <span className="text-lg">📊</span>
          <p className="text-lg font-bold text-amber-600">{totalAmount.toLocaleString()}</p>
          <p className="text-[10px] text-amber-500">₸ всего</p>
        </div>
      </div>

      {/* Payments list — кликабельно → карточка ученика */}
      <div className="space-y-2">
        {payments.length === 0 ? (
          <div className="text-center py-8 text-sm text-[var(--tg-theme-hint-color)]">
            Нет записей о платежах
          </div>
        ) : (
          payments.map(p => {
            const typeLabel = PAYMENT_TYPE_LABELS[p.payment_type] || p.payment_type || '—';
            return (
              <button key={p.id}
                onClick={() => navigate(`/student/${p.student_id}`)}
                className="w-full tg-card text-left hover:shadow-md transition-all active:scale-[0.98]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium block truncate">
                      {getStudentName(p.student_id)}
                    </span>
                    <span className="text-xs text-[var(--tg-theme-hint-color)]">
                      {getCourseTitle(p.course_id)} · {parseFloat(p.amount).toLocaleString()} ₸
                    </span>
                  </div>
                  <span className="ml-2 px-2.5 py-1 rounded-full text-[10px] font-medium bg-green-50 text-green-700 border border-green-100">
                    {typeLabel}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--tg-theme-hint-color)] mb-2">
                  <span>📅 {p.payment_date || '—'}</span>

                </div>
                {p.comment && (
                  <p className="text-xs text-[var(--tg-theme-hint-color)] bg-[var(--tg-theme-secondary-bg-color)] rounded-lg px-2.5 py-1.5">
                    💬 {p.comment}
                  </p>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
