// Mascots - soft filled "paper cutout" style.
// Monkey: taupe brown with a cream face. Turtle: sage shell, cream head.
// The Tiny variants are monoline so they read clearly at 11-16px.

export const MASCOT_COLORS = {
  monkey:     '#8a6e4e',
  monkeyLt:   '#f3e7d1',
  turtle:     '#7a8e5e',
  turtleLt:   '#a3b58a',
  turtleBody: '#cbb89a',
  ink:        '#1a1a1a',
};

export function Monkey({ size = 36, color = MASCOT_COLORS.monkey }) {
  const face = MASCOT_COLORS.monkeyLt;
  return (
    <svg width={size} height={size * 1.05} viewBox="0 0 44 46" fill="none" aria-hidden="true">
      <circle cx="9"  cy="16" r="5" fill={color}/>
      <circle cx="35" cy="16" r="5" fill={color}/>
      <circle cx="9"  cy="16" r="2" fill={face}/>
      <circle cx="35" cy="16" r="2" fill={face}/>
      <path d="M10 28 q0 -4 4 -6 q8 -3 16 0 q4 2 4 6 l 0 6 q0 8 -12 8 q-12 0 -12 -8 z" fill={color}/>
      <ellipse cx="22" cy="36" rx="6.5" ry="5.5" fill={face} opacity="0.92"/>
      <circle cx="15" cy="36" r="3" fill={color}/>
      <circle cx="29" cy="36" r="3" fill={color}/>
      <circle cx="22" cy="18" r="10.5" fill={color}/>
      <path d="M13 17 q4 -4 9 0 q5 -4 9 0 q0 7 -9 11 q-9 -4 -9 -11 z" fill={face}/>
      <ellipse cx="18.5" cy="17" rx="1.4" ry="1.7" fill={MASCOT_COLORS.ink}/>
      <ellipse cx="25.5" cy="17" rx="1.4" ry="1.7" fill={MASCOT_COLORS.ink}/>
      <circle cx="18.9" cy="16.6" r="0.4" fill="#fff"/>
      <circle cx="25.9" cy="16.6" r="0.4" fill="#fff"/>
      <path d="M19 22 q3 1.6 5 0" stroke={MASCOT_COLORS.ink} strokeWidth="1.1" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

export function Turtle({ size = 36, color = MASCOT_COLORS.turtle }) {
  const shellLt = MASCOT_COLORS.turtleLt;
  const body    = MASCOT_COLORS.turtleBody;
  return (
    <svg width={size} height={size * 0.78} viewBox="0 0 44 34" fill="none" aria-hidden="true">
      <path d="M5 22 l -3 -2 q3 -1 4 0 z" fill={body}/>
      <ellipse cx="10" cy="27" rx="4" ry="2.4" fill={body}/>
      <ellipse cx="30" cy="27" rx="4" ry="2.4" fill={body}/>
      <ellipse cx="37" cy="17" rx="5" ry="4.2" fill={body}/>
      <path d="M3 24 q0 -16 19 -16 q19 0 19 16 z" fill={color}/>
      <path d="M3 24 q0 -3 19 -3 q19 0 19 3" fill="none" stroke={color} strokeWidth="1"/>
      <ellipse cx="22" cy="12" rx="4.5" ry="3.4" fill={shellLt}/>
      <ellipse cx="12" cy="17" rx="3.6" ry="2.8" fill={shellLt}/>
      <ellipse cx="32" cy="17" rx="3.6" ry="2.8" fill={shellLt}/>
      <ellipse cx="17" cy="20.5" rx="2.4" ry="1.6" fill={shellLt} opacity="0.6"/>
      <ellipse cx="27" cy="20.5" rx="2.4" ry="1.6" fill={shellLt} opacity="0.6"/>
      <ellipse cx="39" cy="16" rx="1.1" ry="1.4" fill={MASCOT_COLORS.ink}/>
      <circle cx="39.3" cy="15.6" r="0.35" fill="#fff"/>
      <path d="M37.5 18.5 q1.4 1 2.8 0" stroke={MASCOT_COLORS.ink} strokeWidth="0.9" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

export function MonkeyTiny({ size = 16, color = MASCOT_COLORS.ink }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6"  cy="10" r="2.4"/>
      <circle cx="18" cy="10" r="2.4"/>
      <circle cx="12" cy="12" r="6"/>
      <path d="M7 12 q5 4 10 0 q0 4 -5 6 q-5 -2 -5 -6 z"/>
      <circle cx="10" cy="12" r="0.7" fill={color} stroke="none"/>
      <circle cx="14" cy="12" r="0.7" fill={color} stroke="none"/>
    </svg>
  );
}

export function TurtleTiny({ size = 16, color = MASCOT_COLORS.ink }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17 q0 -9 9 -9 q9 0 9 9 z"/>
      <ellipse cx="22" cy="14" rx="2.2" ry="1.8"/>
      <circle cx="22.5" cy="13.5" r="0.45" fill={color} stroke="none"/>
      <path d="M12 9 v8"/>
      <path d="M6 14 q6 -2 12 0"/>
      <path d="M5 18 v1.5"/>
      <path d="M19 18 v1.5"/>
    </svg>
  );
}
