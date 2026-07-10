import { useNavigate } from 'react-router-dom';

interface NavCard {
  icon: string;
  title: string;
  description: string;
  route: string;
}

const navCards: NavCard[] = [
  {
    icon: '👨‍🎓',
    title: 'Ученики',
    description: 'Добавление и просмотр учеников',
    route: '/school/students',
  },
  {
    icon: '📚',
    title: 'Курсы',
    description: 'Группы и учебные программы',
    route: '/school/courses',
  },
  {
    icon: '📅',
    title: 'Занятия',
    description: 'Расписание и проведение занятий',
    route: '/school/lessons',
  },
  {
    icon: '💰',
    title: 'Платежи',
    description: 'История и учёт оплат',
    route: '/school/payments',
  },
  {
    icon: '🏆',
    title: 'Достижения',
    description: 'Награды и достижения учеников',
    route: '/school/achievements',
  },
];

export default function SchoolPage() {
  const navigate = useNavigate();

  return (
    <div className="p-4 space-y-3 animate-fade-in">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-[var(--tg-theme-text-color)]">
          🏫 Школа
        </h1>
        <p className="text-xs text-[var(--tg-theme-hint-color)] mt-0.5">
          Управление учебным процессом
        </p>
      </div>

      {navCards.map((card) => (
        <button
          key={card.route}
          onClick={() => navigate(card.route)}
          className="w-full tg-card flex items-center gap-4 p-4 text-left hover:shadow-md transition-all duration-200 active:scale-[0.98] group"
        >
          <div className="w-12 h-12 rounded-2xl bg-[var(--tg-theme-secondary-bg-color)] flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
            {card.icon}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-base font-semibold text-[var(--tg-theme-text-color)] block">
              {card.title}
            </span>
            <span className="text-xs text-[var(--tg-theme-hint-color)] mt-0.5 block">
              {card.description}
            </span>
          </div>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--tg-theme-hint-color)] shrink-0 group-hover:translate-x-0.5 transition-transform"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      ))}
    </div>
  );
}
