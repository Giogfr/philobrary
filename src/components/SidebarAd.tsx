import { useEffect, useRef } from 'react';

const SIDEBAR_KEY = '901ab337087ec79351af77122363b024';

export default function SidebarAd() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || container.dataset.adLoaded) return;
    container.dataset.adLoaded = '1';

    (window as unknown as Record<string, unknown>).atOptions = {
      'key': SIDEBAR_KEY,
      'format': 'iframe',
      'height': 600,
      'width': 160,
      'params': {}
    };

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.setAttribute('data-cfasync', 'false');
    script.src = `https://www.highperformanceformat.com/${SIDEBAR_KEY}/invoke.js`;
    container.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return (
    <div ref={containerRef} className="w-[160px] h-[600px] flex flex-col items-center" aria-hidden="true" />
  );
}
