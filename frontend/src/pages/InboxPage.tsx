import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { type InboxData, type InboxGroup, type InboxItem } from '../services/api';

const PRIORITY_STYLES: Record<string, { dot: string; bg: string; border: string; text: string }> = {
  high: { dot: 'bg-red-500', bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-700' },
  medium: { dot: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700' },
  low: { dot: 'bg-gray-300', bg: 'bg-gray-50', border: 'border-gray-100', text: 'text-gray-500' },
};

const GROUP_HEADER_STYLES: Record<string, string> = {
  lessons: 'bg-gradient-to-r from-indigo-500 to-indigo-600',
  payments: 'bg-gradient-to-r from-emerald-500 to-emerald-600',
  trials: 'bg-gradient-to-r from-purple-500 to-purple-600',
  attention: 'bg-gradient-to-r from-amber-500 to-orange-500',
  actions: 'bg-gradient-to-r from-gray-400 to-gray-500',
};

function formatWeekday(dateStr: string): string {
  const d = new Date(dateStr);
  const weekdays = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  return weekdays[d.getDay()];
}

function GroupHeader({ group, collapsed, onToggle }: {
  group: InboxGroup;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const urgentCount = group.items.filter(i => i.priority === 'high').length;

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-white shadow-sm transition-all duration-200 active:scale-[0.98]"
      style={{ backgroundColor: 'var(--tg-theme-button-color)' }}
    >        <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg shrink-0">
          {group.icon}
        </div>
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{group.label}</span>
          <span className="text-[11px] font-medium bg-white/20 rounded-full px-2 py-0.5">
            {group.items.length}
          </span>
        </div>
        {urgentCount > 0 && !collapsed && (
          <span className="text-[10px] text-white/80">
            {urgentCount} {urgentCount === 1 ? 'требует' : 'требуют'} внимания
          </span>
        )}
      </div>
      <svg
        className={`w-4 h-4 text-white/70 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}

function InboxCard({ item }: { item: InboxItem }) {
  const navigate = useNavigate();
  const isHigh = item.priority === 'high';
  const styles = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.low;

  return (
    <button
      onClick={() => navigate(item.action_url)}
      className="w-full text-left transition-all duration-150 active:scale-[0.97] group"
    >
      <div className={`rounded-xl p-3.5 ${styles.bg} border ${styles.border} hover:shadow-sm transition-shadow`}>
        <div className="flex items-center gap-3">
          {/* Priority dot */}
          <div className="flex flex-col items-center shrink-0">
            <div className={`w-2.5 h-2.5 rounded-full ${styles.dot} ${isHigh ? 'animate-pulse' : ''}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${styles.text} truncate`}>
                {item.title}
              </span>
              {isHigh && (
                <span className="text-[9px] font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded-full shrink-0">
                  !
                </span>
              )}
            </div>
            {item.subtitle && (
              <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
                {item.subtitle}
              </p>
            )}
          </div>

          {/* Action chip */}
          <div className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all
            ${isHigh
              ? 'bg-red-500 text-white shadow-sm shadow-red-500/30'
              : `${styles.bg} ${styles.text} border ${styles.border}`
            }
            group-hover:opacity-80`}
          >
            {item.action_label}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="inline ml-0.5 -mt-0.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function InboxPage() {
  const navigate = useNavigate();
  const [inbox, setInbox] = useState<InboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadInbox();
    const interval = setInterval(loadInbox, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadInbox = async () => {
    try {
      setLoading(true);
      const data = await api.getInbox();
      setInbox(data);
      setError(null);
    } catch (e) {
      console.error('Failed to load inbox:', e);
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Loading ──────────────────────────────────────────────────────────
  if (loading && !inbox) {
    return (
      <div className="p-4 space-y-4 animate-fade-in">
        <div className="skeleton h-8 w-40 mb-1" />
        <div className="skeleton h-5 w-56 mb-4" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton h-28 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error && !inbox) {
    return (
      <div className="p-4 animate-fade-in">
        <div className="tg-card flex flex-col items-center py-8">
          <span className="text-4xl mb-3">😔</span>
          <p className="text-sm text-[var(--tg-theme-hint-color)] mb-4">{error}</p>
          <button onClick={loadInbox} className="tg-button text-sm">
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (!inbox) return null;

  const totalHigh = inbox.stats.high_priority;

  return (
    <div className="p-4 space-y-3 animate-fade-in pb-6">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tg-theme-text-color)]">
            📥 Сегодня
          </h1>
          <p className="text-xs text-[var(--tg-theme-hint-color)] mt-0.5">
            {formatWeekday(inbox.date)}, {inbox.date}
            {totalHigh > 0 && (
              <span className="text-red-500 font-medium ml-1">
                · {totalHigh} {totalHigh === 1 ? 'требует' : 'требуют'} внимания
              </span>
            )}
          </p>
        </div>
        <button
          onClick={loadInbox}
          className="w-9 h-9 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] flex items-center justify-center hover:opacity-70 transition-opacity text-sm"
          title="Обновить"
        >
          🔄
        </button>
      </div>

      {/* ── Quick summary bar ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-[11px] text-[var(--tg-theme-hint-color)] bg-[var(--tg-theme-secondary-bg-color)] rounded-xl px-3 py-2">
        {inbox.groups.map((g, i) => (
          <span key={g.key} className="flex items-center gap-1">
            <span>{g.icon}</span>
            <span className="font-medium">{g.items.length}</span>
            {i < inbox.groups.length - 1 && <span className="mx-0.5 text-[var(--tg-theme-section-separator-color)]">|</span>}
          </span>
        ))}
        <span className="ml-auto text-[10px] opacity-60">{inbox.stats.total} всего</span>
      </div>

      {/* ── Groups ───────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {inbox.groups.map((group) => {
          const isCollapsed = collapsedGroups[group.key] ?? false;

          return (
            <div key={group.key} className="space-y-1.5">
              <GroupHeader
                group={group}
                collapsed={isCollapsed}
                onToggle={() => toggleGroup(group.key)}
              />

              {!isCollapsed && (
                <div className="space-y-1.5 pl-2 animate-slide-up">
                  {group.items.map((item) => (
                    <InboxCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {inbox.groups.length === 0 && (
        <div className="tg-card flex flex-col items-center py-10 text-center">
          <span className="text-5xl mb-4">🎉</span>
          <p className="text-base font-semibold text-[var(--tg-theme-text-color)] mb-1">
            Всё отлично!
          </p>
          <p className="text-sm text-[var(--tg-theme-hint-color)]">
            Сегодня нет задач, требующих внимания.
            Можно отдохнуть 🧘
          </p>
        </div>
      )}

      {/* ── Auto-refresh hint ────────────────────────────────────────── */}
      <p className="text-center text-[9px] text-[var(--tg-theme-hint-color)] pt-1">
        Данные обновляются автоматически · {inbox.stats.total} сигналов
      </p>
    </div>
  );
}
