import { useEffect, useRef } from 'react';
import { mountAd } from '../lib/adLoader';

const KEY = 'ad027cb5c3ceeb72ca3cb64a95381d9d';

export default function BannerAd() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container) mountAd(container, { key: KEY, width: 728, height: 90 });
  }, []);

  return (
    <div ref={containerRef} className="w-full flex justify-center min-h-[90px] no-print" aria-hidden="true" />
  );
}
