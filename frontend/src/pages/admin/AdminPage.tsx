import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

export default function AdminPage() {
  const { permissions, user } = useAuth();
  const navigate = useNavigate();
  const [paymentsCount, setPaymentsCount] = useState(0);
  const [coursesCount, setCoursesCount] = useState(0);
  const [studentsCount, setStudentsCount] = useState(0);

  useEffect(() => {
    if (!permissions.canManageUsers) {
      navigate('/');
      return;
    }
    api.getPayments().then(d => setPaymentsCount(d.payments.length)).catch(() => {});
    api.getCourses().then(d => setCoursesCount(d.courses.length)).catch(() => {});
    api.getStudents().then(d => setStudentsCount(d.students.length)).catch(() => {});
  }, [permissions.canManageUsers, navigate]);

  if (!permissions.canManageUsers) return null;

  const adminSections = [
    {
      title: 'Курсы',
      count: coursesCount,
      icon: '📚',
      color: '#6C5CE7',
      path: '/admin/courses',
      desc: 'Создание и управление курсами',
    },
    {
      title: 'Ученики',
      count: studentsCount,
      icon: '👨‍🎓',
      color: '#00B894',
      path: '/admin/students',
      desc: 'Добавление и редактирование',
    },
    {
      title: 'Пользователи',
      count: null,
      icon: '👥',
      color: '#FD79A8',
      path: '/admin/users',
      desc: 'Управление ролями',
    },
    {
      title: 'Оплаты',
      count: paymentsCount,
      icon: '💰',
      color: '#FDCB6E',
      path: '/admin/payments',
      desc: 'Журнал платежей',
    },
  ];

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--tg-theme-text-color)]">
          Панель управления
        </h2>
        <div className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-medium border border-blue-100">
          {user?.first_name}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-[var(--tg-theme-section-bg-color)] rounded-2xl p-3 text-center shadow-sm">
          <span className="text-lg font-bold">{coursesCount}</span>
          <p className="text-[10px] text-[var(--tg-theme-hint-color)]">📚 Курсы</p>
        </div>
        <div className="bg-[var(--tg-theme-section-bg-color)] rounded-2xl p-3 text-center shadow-sm">
          <span className="text-lg font-bold">{studentsCount}</span>
          <p className="text-[10px] text-[var(--tg-theme-hint-color)]">👨‍🎓 Ученики</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-3 text-center border border-green-100">
          <span className="text-lg font-bold text-green-600">{paymentsCount}</span>
          <p className="text-[10px] text-green-500">💰 Платежи</p>
        </div>
        <div className="bg-[var(--tg-theme-section-bg-color)] rounded-2xl p-3 text-center shadow-sm">
          <span className="text-lg font-bold">{user?.role === 'owner' ? '👑' : 'A'}</span>
          <p className="text-[10px] text-[var(--tg-theme-hint-color)]">Админ</p>
        </div>
      </div>

      {/* Admin sections */}
      <div className="space-y-3">
        {adminSections.map(section => (
          <button
            key={section.path}
            onClick={() => navigate(section.path)}
            className="w-full tg-card flex items-center gap-4 hover:shadow-md transition-all active:scale-[0.98]"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ backgroundColor: section.color + '20' }}
            >
              {section.icon}
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-[var(--tg-theme-text-color)]">
                  {section.title}
                </span>
                {section.count !== null && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                    {section.count}
                  </span>
                )}
              </div>
              <span className="text-xs text-[var(--tg-theme-hint-color)]">
                {section.desc}
              </span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--tg-theme-hint-color)]">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
