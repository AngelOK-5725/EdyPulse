import { useNavigate } from 'react-router-dom';

export default function UnderConstructionPage() {
  const navigate = useNavigate();

  return (
    <div className="p-4 animate-fade-in min-h-full flex flex-col items-center justify-center">
      <div className="tg-card flex flex-col items-center py-12 px-6 text-center max-w-sm mx-auto">
        <span className="text-6xl mb-5">🚧</span>
        <h2 className="text-lg font-semibold text-[var(--tg-theme-text-color)] mb-2">
          Раздел находится в разработке
        </h2>
        <p className="text-sm text-[var(--tg-theme-hint-color)] leading-relaxed">
          Эта возможность появится
          <br />
          в одном из следующих обновлений EduPulse.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-8 tg-button text-sm flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Назад
        </button>
      </div>
    </div>
  );
}
