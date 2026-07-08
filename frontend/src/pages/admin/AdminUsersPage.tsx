import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

interface ManagedUser {
  id: string;
  telegram_id: string;
  first_name: string;
  last_name: string;
  username: string;
  role: string;
  is_active: string;
}

const ROLES = [
  { value: 'admin', label: 'Админ', color: 'bg-blue-50 text-blue-600 border-blue-100' },
  { value: 'tester', label: 'Тестер', color: 'bg-amber-50 text-amber-600 border-amber-100' },
  { value: 'user', label: 'Пользователь', color: 'bg-gray-50 text-gray-600 border-gray-100' },
];

export default function AdminUsersPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    loadUsers();
  }, [isAdmin]);

  const loadUsers = async () => {
    try {
      const data = await api.listUsers();
      setUsers(data.users || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleRoleChange = async (telegramId: number, role: string) => {
    try {
      await api.setUserRole(telegramId, role);
      await loadUsers();
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="p-4 text-center text-sm text-[var(--tg-theme-hint-color)]">Загрузка...</div>;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/admin')} className="text-sm text-[var(--tg-theme-button-color)] flex items-center gap-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          Назад
        </button>
        <h2 className="text-base font-semibold">Пользователи</h2>
        <div className="w-12" />
      </div>

      {users.length === 0 && (
        <div className="text-center py-8 text-sm text-[var(--tg-theme-hint-color)]">
          Пользователи появятся после первого входа через Telegram
        </div>
      )}

      <div className="space-y-2">
        {users.map(u => {
          const roleInfo = ROLES.find(r => r.value === u.role) || ROLES[2];
          const currentRole = u.role || 'user';
          const otherRoles = ROLES.filter(r => r.value !== currentRole);

          return (
            <div key={u.telegram_id} className="tg-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[var(--tg-theme-secondary-bg-color)] flex items-center justify-center text-sm font-bold shrink-0">
                  {u.first_name?.[0]}{u.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium block truncate">
                    {u.first_name} {u.last_name}
                  </span>
                  <span className="text-xs text-[var(--tg-theme-hint-color)]">
                    @{u.username || '—'} · ID: {u.telegram_id}
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${roleInfo.color}`}>
                  {roleInfo.label}
                </span>
              </div>

              {/* Role changer */}
              <div className="flex gap-2 pt-2 border-t border-[var(--tg-theme-section-separator-color)]">
                {otherRoles.map(role => (
                  <button
                    key={role.value}
                    onClick={() => handleRoleChange(parseInt(u.telegram_id), role.value)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all active:scale-95 ${role.color}`}
                  >
                    Сделать {role.label.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
