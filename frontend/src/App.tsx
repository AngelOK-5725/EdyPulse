import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import BottomNav from './components/BottomNav';
import InboxPage from './pages/InboxPage';
import HomePage from './pages/HomePage';
import StatisticsPage from './pages/StatisticsPage';
import AccountPage from './pages/AccountPage';
import AdminPage from './pages/admin/AdminPage';
import AdminCoursesPage from './pages/admin/AdminCoursesPage';
import AdminStudentsPage from './pages/admin/AdminStudentsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage';
import StudentCardPage from './pages/StudentCardPage';
import LessonDetailPage from './pages/LessonDetailPage';
import SystemPage from './pages/SystemPage';
import SchoolPage from './pages/SchoolPage';
import UnderConstructionPage from './pages/UnderConstructionPage';
import StudentsPage from './pages/StudentsPage';
import CoursesPage from './pages/CoursesPage';
import LessonsPage from './pages/LessonsPage';

function AppContent() {
  const { loading, error, user, login } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--tg-theme-secondary-bg-color)] flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-12 h-12 rounded-xl bg-[var(--tg-theme-button-color)] flex items-center justify-center mx-auto mb-3 animate-pulse">
            <span className="text-xl font-bold text-white">EP</span>
          </div>
          <p className="text-sm text-[var(--tg-theme-hint-color)]">Загрузка...</p>
        </div>
      </div>
    );
  }

  // ── Экран ошибки авторизации: логин не удался, пользователь не получен ─────
  if (!loading && !user && error) {
    return (
      <div className="min-h-screen bg-[var(--tg-theme-secondary-bg-color)] flex items-center justify-center p-8">
        <div className="text-center max-w-sm animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-lg font-bold text-[var(--tg-theme-text-color)] mb-2">
            Ошибка авторизации
          </h2>
          <p className="text-sm text-[var(--tg-theme-hint-color)] mb-6 leading-relaxed">
            Не удалось подключиться к серверу. Проверьте подключение к интернету
            и попробуйте снова.
          </p>
          <div className="space-y-3">
            <button
              onClick={login}
              className="w-full py-3 rounded-2xl bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)] font-semibold text-sm transition-all active:scale-[0.98] hover:opacity-90"
            >
              Повторить попытку
            </button>
            <p className="text-xs text-[var(--tg-theme-hint-color)] opacity-60">
              Ошибка: {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--tg-theme-secondary-bg-color)] flex flex-col safe-top">
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Routes>
          <Route path="/" element={<InboxPage />} />
          <Route path="/dashboard" element={<HomePage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/courses" element={<AdminCoursesPage />} />
          <Route path="/admin/students" element={<AdminStudentsPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/payments" element={<AdminPaymentsPage />} />
          <Route path="/student/:id" element={<StudentCardPage />} />
          <Route path="/lesson/:lessonId" element={<LessonDetailPage />} />
          <Route path="/school" element={<SchoolPage />} />
          <Route path="/school/students" element={<StudentsPage />} />
          <Route path="/school/courses" element={<CoursesPage />} />
          <Route path="/school/courses/:id" element={<UnderConstructionPage />} />
          <Route path="/school/lessons" element={<LessonsPage />} />
          <Route path="/school/payments" element={<UnderConstructionPage />} />
          <Route path="/school/achievements" element={<UnderConstructionPage />} />
          <Route path="/owner" element={<SystemPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
