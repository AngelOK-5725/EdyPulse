import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AccountPage() {
  const { user, logout, isAdmin, isOwner } = useAuth();
  const navigate = useNavigate();

  // Получаем данные пользователя напрямую из Telegram Mini App
  const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;

  const roleLabels: Record<string, { label: string; color: string }> = {
    owner: { label: 'Владелец', color: 'bg-purple-50 text-purple-600 border-purple-100' },
    admin: { label: 'Администратор', color: 'bg-blue-50 text-blue-600 border-blue-100' },
    tester: { label: 'Тестировщик', color: 'bg-amber-50 text-amber-600 border-amber-100' },
    user: { label: 'Пользователь', color: 'bg-gray-50 text-gray-600 border-gray-100' },
  };

  const roleInfo = roleLabels[user?.role || 'user'];

  // Приоритет: Telegram Mini App (initDataUnsafe.user) → Backend (AuthContext)
  // Telegram — источник правды для first_name, last_name, username, photo_url
  const firstName = telegramUser?.first_name || user?.first_name || '';
  const lastName = telegramUser?.last_name || user?.last_name || '';
  const displayUsername = telegramUser?.username || user?.username;
  const displayPhoto = telegramUser?.photo_url || user?.photo_url;
  const displayTelegramId = telegramUser?.id || user?.telegram_id;

  // Имя: если нет first_name + last_name, показываем @username
  const displayName = [firstName, lastName].filter(Boolean).join(' ')
    || (displayUsername ? `@${displayUsername}` : 'Telegram User');

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* Profile Card */}
      <div className="tg-card flex flex-col items-center py-6">
        {displayPhoto ? (
          <img
            src={displayPhoto}
            alt=""
            className="w-20 h-20 rounded-full mb-3 border-2 border-[var(--tg-theme-button-color)]"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--tg-theme-button-color)] to-purple-600 flex items-center justify-center text-3xl text-white mb-3 shadow-lg">
            {displayName[0]}
          </div>
        )}
        <h2 className="text-xl font-bold text-[var(--tg-theme-text-color)]">
          {displayName}
        </h2>
        {displayUsername && (
          <span className="text-sm text-[var(--tg-theme-hint-color)] mt-0.5">
            @{displayUsername}
          </span>
        )}
        {displayTelegramId && (
          <span className="text-xs text-[var(--tg-theme-hint-color)] mt-0.5 opacity-60">
            ID: {displayTelegramId}
          </span>
        )}
        <div className={`mt-3 px-4 py-1.5 rounded-full text-sm font-medium border ${roleInfo.color}`}>
          {roleInfo.label}
        </div>
      </div>

      {/* Settings */}
      <div className="tg-card">
        <h3 className="text-base font-semibold text-[var(--tg-theme-text-color)] mb-3">Настройки</h3>
        <div className="space-y-1">
          <button className="w-full flex items-center justify-between py-3 px-2 rounded-xl hover:bg-[var(--tg-theme-secondary-bg-color)] transition-colors">
            <span className="text-sm text-[var(--tg-theme-text-color)]">Уведомления</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--tg-theme-hint-color)]">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          {isAdmin && (
            <button onClick={() => navigate('/admin/courses')} className="w-full flex items-center justify-between py-3 px-2 rounded-xl hover:bg-[var(--tg-theme-secondary-bg-color)] transition-colors">
              <span className="text-sm text-[var(--tg-theme-text-color)]">Управление курсами</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--tg-theme-hint-color)]">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
          {isAdmin && (
            <button onClick={() => navigate('/admin/students')} className="w-full flex items-center justify-between py-3 px-2 rounded-xl hover:bg-[var(--tg-theme-secondary-bg-color)] transition-colors">
              <span className="text-sm text-[var(--tg-theme-text-color)]">Ученики</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--tg-theme-hint-color)]">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
          {isAdmin && (
            <button onClick={() => navigate('/admin/users')} className="w-full flex items-center justify-between py-3 px-2 rounded-xl hover:bg-[var(--tg-theme-secondary-bg-color)] transition-colors">
              <span className="text-sm text-[var(--tg-theme-text-color)]">Пользователи и роли</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--tg-theme-hint-color)]">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
          {isOwner && (
            <button onClick={() => navigate('/owner')} className="w-full flex items-center justify-between py-3 px-2 rounded-xl hover:bg-[var(--tg-theme-secondary-bg-color)] transition-colors">
              <span className="text-sm font-medium text-purple-600">⚙️ Панель владельца</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--tg-theme-hint-color)]">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* About */}
      <div className="tg-card">
        <h3 className="text-base font-semibold text-[var(--tg-theme-text-color)] mb-3">О приложении</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--tg-theme-hint-color)]">Версия</span>
            <span className="text-sm text-[var(--tg-theme-text-color)]">1.0.0</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--tg-theme-hint-color)]">Платформа</span>
            <span className="text-sm text-[var(--tg-theme-text-color)]">Telegram Mini App</span>
          </div>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full py-3 rounded-2xl border border-red-200 text-red-500 font-semibold text-sm hover:bg-red-50 transition-colors active:scale-[0.98]"
      >
        Выйти из аккаунта
      </button>
    </div>
  );
}
