import { useEffect, useRef } from 'react';
import { mountAd } from '../lib/adLoader';

const SIDEBAR_KEY = '901ab337087ec79351af77122363b024';

export default function SidebarAd() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container) mountAd(container, { key: SIDEBAR_KEY, width: 160, height: 600 });
  }, []);

  return (
    <div ref={containerRef} className="w-[160px] h-[600px] flex flex-col items-center" aria-hidden="true" />
  );
}
