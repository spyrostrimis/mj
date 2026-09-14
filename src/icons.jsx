// UI icons - monoline stroke style, sized to sit quietly beside the mascots.

export function CalIcon({ size = 22, color = '#1a1a1a' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15" rx="2.2"/>
      <path d="M8 3v4M16 3v4M3.5 9.5h17"/>
    </svg>
  );
}

export function PlusIcon({ size = 18, color = '#fafaf7' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  );
}

export function ChevronLeft({ size = 18, color = '#1a1a1a' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5l-7 7 7 7"/>
    </svg>
  );
}

export function ChevronRight({ size = 18, color = '#1a1a1a' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5l7 7-7 7"/>
    </svg>
  );
}

export function CheckIcon({ size = 14, color = '#fafaf7' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l5 5 9-12"/>
    </svg>
  );
}

export function InsightsIcon({ size = 22, color = '#1a1a1a' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke={color} strokeWidth="1.6" strokeLinecap="round">
      <path d="M5 6h12M5 12h8M5 18h14"/>
    </svg>
  );
}

export function TodayIcon({ size = 22, color = '#1a1a1a' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8"/>
      <path d="M12 7v5l3.2 2.2"/>
    </svg>
  );
}
