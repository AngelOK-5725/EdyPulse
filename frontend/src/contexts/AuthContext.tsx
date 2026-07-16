import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api from '../services/api';

export interface User {
  id: string;
  telegram_id: string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  role: 'owner' | 'admin' | 'tester' | 'user';
  is_active: boolean;
}

// ─── Единая система семантических прав доступа ────────────────────────────
// Матрица доступа:
// Действие                     Teacher  Admin  Owner
// Просмотр учеников              ✅      ✅     ✅
// Просмотр карточки ученика      ✅      ✅     ✅
// Добавление ученика             ✅      ✅     ✅
// Редактирование ученика         ✅      ✅     ✅
// Добавление платежа             ✅      ✅     ✅
// Просмотр истории платежей      ✅      ✅     ✅
// Архивирование ученика          ✅      ✅     ✅
// Восстановление из архива       ✅      ✅     ✅
// Удаление ученика навсегда      ❌      ❌     ✅
// Управление пользователями      ❌      ✅     ✅
// Панель Owner                   ❌      ❌     ✅

export interface Permissions {
  canViewStudents: boolean;
  canViewStudentCard: boolean;
  canEditStudents: boolean;
  canArchiveStudents: boolean;
  canDeleteStudents: boolean;
  canAddPayments: boolean;
  canViewPayments: boolean;
  canManageUsers: boolean;
  canOpenOwnerPanel: boolean;
}

function computePermissions(role: string | undefined): Permissions {
  const isOwner = role === 'owner';
  const isAdmin = role === 'admin' || isOwner;
  // Teacher = 'user' role (базовый преподавательский доступ)
  const isTeacher = role === 'user' || isAdmin;

  return {
    canViewStudents: true,                // Все аутентифицированные
    canViewStudentCard: true,             // Все аутентифицированные
    canEditStudents: isTeacher,           // Teacher+
    canArchiveStudents: isTeacher,        // Teacher+
    canDeleteStudents: isOwner,           // Только Owner
    canAddPayments: isTeacher,            // Teacher+
    canViewPayments: true,                // Все аутентифицированные
    canManageUsers: isAdmin,              // Admin+
    canOpenOwnerPanel: isOwner,           // Только Owner
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isOwner: boolean;
  isTester: boolean;
  permissions: Permissions;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const telegramWebApp = window.Telegram?.WebApp;
      const initData = telegramWebApp?.initData;

      // ── Диагностика: проверяем состояние Telegram WebApp ──────────────────
      console.log('[AUTH] login() started', {
        hasTelegram: !!window.Telegram,
        hasWebApp: !!telegramWebApp,
        initDataLength: initData?.length ?? 0,
        initDataPreview: initData ? initData.slice(0, 80) + '...' : '(empty)',
        apiBase: import.meta.env.VITE_API_URL || '/api',
        savedToken: localStorage.getItem('edupulse_token') ? 'exists' : 'none',
      });

      if (!initData || initData.trim() === '') {
        console.warn('[AUTH] initData is empty — either outside Telegram or Mini App not ready');
        // Running outside Telegram — use demo mode
        setUser({
          id: '0',
          telegram_id: '0',
          first_name: 'Демо',
          last_name: 'Пользователь',
          username: 'demo',
          role: 'owner',
          is_active: true,
        });
        setLoading(false);
        return;
      }

      console.log('[AUTH] Sending login request to /api/auth/login');
      const result = await api.login(initData);
      const token = result.access_token;

      console.log('[AUTH] Login success', { role: result.user.role, tokenPreview: token.slice(0, 20) + '...' });

      // Store token
      localStorage.setItem('edupulse_token', token);
      // Set default auth header for future requests
      api.setToken(token);

      setUser({
        ...result.user,
        role: result.user.role as 'owner' | 'admin' | 'tester' | 'user',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка авторизации';
      setError(message);
      console.error('[AUTH] Login failed:', {
        errorMessage: message,
        error: err,
        apiBase: import.meta.env.VITE_API_URL || '/api',
        hasSavedToken: !!localStorage.getItem('edupulse_token'),
      });

      // Fallback: try to use cached token
      const savedToken = localStorage.getItem('edupulse_token');
      if (savedToken) {
        console.log('[AUTH] Trying saved token...');
        api.setToken(savedToken);
        try {
          const me = await api.getMe();
          console.log('[AUTH] Saved token still valid', { role: me.role });
          setUser({
            ...me,
            role: me.role as 'owner' | 'admin' | 'tester' | 'user',
          });
        } catch {
          console.warn('[AUTH] Saved token expired, clearing');
          localStorage.removeItem('edupulse_token');
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('edupulse_token');
    api.setToken('');
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.close();
    }
  }, []);

  // Auto-login on mount
  useEffect(() => {
    // Restore token from storage
    const savedToken = localStorage.getItem('edupulse_token');
    if (savedToken) {
      api.setToken(savedToken);
    }
    login();
  }, [login]);

  const isOwner = user?.role === 'owner';
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const isTester = user?.role === 'tester';
  const permissions = computePermissions(user?.role);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, isAdmin, isOwner, isTester, permissions }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
