import { useEffect, useRef } from 'react';

const KEY = 'ad027cb5c3ceeb72ca3cb64a95381d9d';

export default function BannerAd() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || container.dataset.adLoaded) return;
    container.dataset.adLoaded = '1';

    (window as unknown as Record<string, unknown>).atOptions = {
      key: KEY,
      format: 'iframe',
      height: 90,
      width: 728,
      params: {}
    };

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.setAttribute('data-cfasync', 'false');
    script.src = `https://www.highperformanceformat.com/${KEY}/invoke.js`;
    container.appendChild(script);

    return () => { script.remove(); };
  }, []);

  return (
    <div ref={containerRef} className="w-full flex justify-center min-h-[90px] no-print" aria-hidden="true" />
  );
}
