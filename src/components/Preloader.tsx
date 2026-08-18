import { useEffect, useState } from 'react';

function isDark() {
  if (typeof document === 'undefined') return true;
  return document.documentElement.classList.contains('dark');
}

export function Preloader() {
  const [stage, setStage] = useState(0);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(isDark());
    const t1 = setTimeout(() => setStage(1), 200);
    const t2 = setTimeout(() => setStage(2), 500);
    const t3 = setTimeout(() => setStage(3), 1000);
    const t4 = setTimeout(() => setStage(4), 1600);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  if (stage === 4) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.87,0,0.13,1)]
      ${stage >= 3 ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}
      style={{ backgroundColor: dark ? '#000000' : '#FFFFFF' }}
    >
      <div className={`flex items-center gap-4 text-3xl md:text-5xl font-bold tracking-tight`} style={{ color: dark ? '#FFFFFF' : '#000000' }}>
        <div
          className={`rounded-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
            ${stage >= 1 ? 'w-3 h-3 md:w-4 md:h-4 opacity-100 scale-100' : 'w-0 h-0 opacity-0 scale-0'}
          `}
          style={{ backgroundColor: dark ? '#FFFFFF' : '#000000' }}
        />
        <div
          className={`transition-all duration-500 ease-out transform
            ${stage >= 2 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}
          `}
        >
          Philobrary
        </div>
      </div>
    </div>
  );
}
