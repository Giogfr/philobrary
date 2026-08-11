import React from 'react';
import type { SupportedLanguage } from '../store';

interface FlagProps {
  code: SupportedLanguage;
  className?: string;
}

const SH = (paths: React.ReactNode) => paths;

const FLAG_SVGS: Record<SupportedLanguage, React.ReactNode> = {
  en: (
    <>
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0 L60 40 M60 0 L0 40" stroke="#fff" strokeWidth="7" />
      <path d="M0 0 L60 40 M60 0 L0 40" stroke="#C8102E" strokeWidth="3" />
      <path d="M30 0 V40 M0 20 H60" stroke="#fff" strokeWidth="11" />
      <path d="M30 0 V40 M0 20 H60" stroke="#C8102E" strokeWidth="5" />
    </>
  ),
  ka: (
    <>
      <rect width="60" height="40" fill="#FFF" />
      <rect x="26" y="0" width="8" height="40" fill="#FF0000" />
      <rect x="0" y="16" width="60" height="8" fill="#FF0000" />
      <rect x="9" y="4" width="4" height="9" fill="#FF0000" />
      <rect x="6.5" y="6.5" width="9" height="4" fill="#FF0000" />
      <rect x="47" y="4" width="4" height="9" fill="#FF0000" />
      <rect x="44.5" y="6.5" width="9" height="4" fill="#FF0000" />
      <rect x="9" y="27" width="4" height="9" fill="#FF0000" />
      <rect x="6.5" y="29.5" width="9" height="4" fill="#FF0000" />
      <rect x="47" y="27" width="4" height="9" fill="#FF0000" />
      <rect x="44.5" y="29.5" width="9" height="4" fill="#FF0000" />
    </>
  ),
  ru: (
    <>
      <rect width="60" height="13.34" fill="#FFF" />
      <rect y="13.34" width="60" height="13.33" fill="#0039A6" />
      <rect y="26.67" width="60" height="13.33" fill="#D52B1E" />
    </>
  ),
  pl: (
    <>
      <rect width="60" height="20" fill="#FFF" />
      <rect y="20" width="60" height="20" fill="#DC143C" />
    </>
  ),
  he: (
    <>
      <rect width="60" height="40" fill="#FFF" />
      <rect width="60" height="5.5" fill="#0038B8" />
      <rect y="34.5" width="60" height="5.5" fill="#0038B8" />
      <polygon points="30,10 40,31 20,31" fill="none" stroke="#0038B8" strokeWidth="2.6" />
      <polygon points="30,30 40,9 20,9" fill="none" stroke="#0038B8" strokeWidth="2.6" />
    </>
  ),
  ar: (
    <>
      <rect width="60" height="40" fill="#165D31" />
      <rect x="8" y="24" width="44" height="5" fill="#FFF" transform="rotate(-20 30 26.5)" />
      <rect x="13" y="14" width="34" height="4" fill="#FFF" transform="rotate(18 30 16)" />
      <rect x="5" y="11" width="6" height="18" fill="#FFF" />
      <rect x="4" y="8" width="8" height="3" fill="#FFF" />
      <rect x="4" y="29" width="8" height="3" fill="#FFF" />
    </>
  ),
  es: (
    <>
      <rect width="60" height="40" fill="#AA151B" />
      <rect y="10" width="60" height="20" fill="#F1BF00" />
    </>
  ),
  fr: (
    <>
      <rect width="20" height="40" fill="#0055A4" />
      <rect x="20" width="20" height="40" fill="#FFF" />
      <rect x="40" width="20" height="40" fill="#EF4135" />
    </>
  ),
  de: (
    <>
      <rect width="60" height="13.34" fill="#000" />
      <rect y="13.34" width="60" height="13.33" fill="#DD0000" />
      <rect y="26.67" width="60" height="13.33" fill="#FFCE00" />
    </>
  ),
  it: (
    <>
      <rect width="20" height="40" fill="#009246" />
      <rect x="20" width="20" height="40" fill="#FFF" />
      <rect x="40" width="20" height="40" fill="#CE2B37" />
    </>
  ),
  pt: (
    <>
      <rect width="24" height="40" fill="#046A38" />
      <rect x="24" width="36" height="40" fill="#DA291C" />
      <circle cx="30" cy="20" r="8.5" fill="#FFE900" />
      <circle cx="30" cy="20" r="8.5" fill="none" stroke="#FFF" strokeWidth="1" />
      <circle cx="30" cy="20" r="4.5" fill="#DA291C" />
      <circle cx="30" cy="20" r="1.5" fill="#FFE900" />
    </>
  ),
  tr: (
    <>
      <rect width="60" height="40" fill="#E30A17" />
      <circle cx="24" cy="20" r="12" fill="#FFF" />
      <circle cx="28" cy="20" r="9.5" fill="#E30A17" />
      <polygon
        points="37.5,8.5 40.6,15 47.8,15.1 42.1,19.3 44.9,25.8 38,21.9 31.1,25.8 33.9,19.3 28.2,15.1 35.4,15"
        fill="#FFF"
      />
    </>
  ),
  ja: (
    <>
      <rect width="60" height="40" fill="#FFF" />
      <circle cx="30" cy="20" r="11.5" fill="#BC002D" />
    </>
  ),
  zh: (
    <>
      <rect width="60" height="40" fill="#DE2910" />
      <path d="M12 5l1.7 3.5 3.8.5-2.7 2.7.7 3.8L12 13.6 8.5 15.5l.7-3.8-2.7-2.7 3.8-.5z" fill="#FFDE00" />
      <path d="M22 3.5l.9 1.9 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z" fill="#FFDE00" transform="rotate(24 22 3.5)" />
      <path d="M24.5 8.5l.9 1.9 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z" fill="#FFDE00" transform="rotate(48 24.5 8.5)" />
      <path d="M23 12.5l.9 1.9 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z" fill="#FFDE00" transform="rotate(72 23 12.5)" />
      <path d="M21.5 16.5l.9 1.9 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z" fill="#FFDE00" transform="rotate(95 21.5 16.5)" />
    </>
  ),
  uk: (
    <>
      <rect width="60" height="20" fill="#005BBB" />
      <rect y="20" width="60" height="20" fill="#FFD500" />
    </>
  ),
};

export function Flag({ code, className = '' }: FlagProps) {
  return (
    <svg
      viewBox="0 0 60 40"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-[3px] overflow-hidden shadow-sm ring-1 ring-black/10 ${className}`}
    >
      {FLAG_SVGS[code] || SH(<rect width="60" height="40" fill="#94A3B8" />)}
    </svg>
  );
}
