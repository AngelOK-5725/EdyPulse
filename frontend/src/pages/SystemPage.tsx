import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { type SystemStats } from '../services/api';

export default function SystemPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await api.getSystemStats();
      setStats(data);
      setError(null);
    } catch (e) {
      console.error('Failed to load system stats:', e);
      setError('Не удалось загрузить статистику системы');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4 animate-fade-in">
        <div className="skeleton h-6 w-40 mb-2" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-sm text-[var(--tg-theme-button-color)] flex items-center gap-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          Назад
        </button>
        <div className="px-3 py-1 rounded-full bg-purple-50 text-purple-600 text-xs font-medium border border-purple-100">
          Owner
        </div>
      </div>

      <h2 className="text-lg font-semibold text-[var(--tg-theme-text-color)]">
        Панель владельца
      </h2>

      {error && !stats && (
        <div className="tg-card flex flex-col items-center py-6">
          <span className="text-3xl mb-2">😔</span>
          <p className="text-sm text-[var(--tg-theme-hint-color)] mb-3">{error}</p>
          <button onClick={loadStats} className="tg-button text-sm">Попробовать снова</button>
        </div>
      )}

      {stats && (
        <>
          {/* Main stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--tg-theme-section-bg-color)] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">👥</span>
                <span className="text-[10px] text-[var(--tg-theme-hint-color)]">Пользователей</span>
              </div>
              <span className="text-2xl font-bold text-[var(--tg-theme-text-color)]">{stats.users_total}</span>
            </div>
            <div className="bg-[var(--tg-theme-section-bg-color)] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🟢</span>
                <span className="text-[10px] text-[var(--tg-theme-hint-color)]">Активных (7д)</span>
              </div>
              <span className="text-2xl font-bold text-green-500">{stats.users_active_7d}</span>
            </div>
            <div className="bg-[var(--tg-theme-section-bg-color)] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">📚</span>
                <span className="text-[10px] text-[var(--tg-theme-hint-color)]">Курсов</span>
              </div>
              <span className="text-2xl font-bold text-[var(--tg-theme-text-color)]">{stats.courses_total}</span>
            </div>
            <div className="bg-[var(--tg-theme-section-bg-color)] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">👨‍🏫</span>
                <span className="text-[10px] text-[var(--tg-theme-hint-color)]">Учителей</span>
              </div>
              <span className="text-2xl font-bold text-[var(--tg-theme-text-color)]">{stats.teachers_total}</span>
            </div>
            <div className="bg-[var(--tg-theme-section-bg-color)] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">👨‍🎓</span>
                <span className="text-[10px] text-[var(--tg-theme-hint-color)]">Учеников</span>
              </div>
              <span className="text-2xl font-bold text-[var(--tg-theme-text-color)]">{stats.students_total}</span>
            </div>
            <div className="bg-[var(--tg-theme-section-bg-color)] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">📅</span>
                <span className="text-[10px] text-[var(--tg-theme-hint-color)]">Занятий</span>
              </div>
              <span className="text-2xl font-bold text-[var(--tg-theme-text-color)]">{stats.lessons_total}</span>
            </div>
          </div>

          {/* System Status */}
          <div className="tg-card">
            <h3 className="text-sm font-semibold text-[var(--tg-theme-text-color)] mb-3 flex items-center gap-2">
              <span>🖥️</span> Системный статус
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--tg-theme-hint-color)]">Google Sheets</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${stats.google_sheets ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                  {stats.google_sheets ? '🟢 Online' : '🟡 Demo'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--tg-theme-hint-color)]">API</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200">
                  🟢 {stats.api_status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--tg-theme-hint-color)]">Backend</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200">
                  🟢 {stats.backend_status}
                </span>
              </div>
              {stats.paid_amount > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-[var(--tg-theme-section-separator-color)]">
                  <span className="text-sm text-[var(--tg-theme-hint-color)]">Всего оплат</span>
                  <span className="text-sm font-bold text-green-600">{stats.paid_amount.toLocaleString()} ₽</span>
                </div>
              )}
            </div>
          </div>

          {/* Recent registrations */}
          {stats.recent_users.length > 0 && (
            <div className="tg-card">
              <h3 className="text-sm font-semibold text-[var(--tg-theme-text-color)] mb-3 flex items-center gap-2">
                <span>📋</span> Последние регистрации
              </h3>
              <div className="space-y-2">
                {stats.recent_users.map((u, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5">
                    <div className="w-7 h-7 rounded-full bg-[var(--tg-theme-secondary-bg-color)] flex items-center justify-center text-[9px] font-bold shrink-0">
                      {u.first_name?.[0] || '?'}{u.last_name?.[0] || ''}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium truncate block">
                        {u.first_name} {u.last_name}
                      </span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                      u.role === 'owner' ? 'bg-purple-50 text-purple-600' :
                      u.role === 'admin' ? 'bg-blue-50 text-blue-600' :
                      u.role === 'tester' ? 'bg-amber-50 text-amber-600' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {u.role}
                    </span>
                    {u.created_at && (
                      <span className="text-[9px] text-[var(--tg-theme-hint-color)] shrink-0">
                        {u.created_at.split('T')[0]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
