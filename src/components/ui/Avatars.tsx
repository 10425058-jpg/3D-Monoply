import React from 'react';

export const CharacterAvatar: React.FC<{
  character: 'You' | 'Victoria' | 'Arthur' | 'Elena' | string;
  size?: number;
  hasCrown?: boolean;
}> = ({ character, size = 44, hasCrown = false }) => {
  const getAvatarSvg = () => {
    switch (character.toLowerCase()) {
      case 'you':
      case 'you (tycoon)':
        return (
          <svg viewBox="0 0 100 100" width={size} height={size} className="overflow-visible">
            <defs>
              <linearGradient id="bg-you" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill="url(#bg-you)" stroke="#fbbf24" strokeWidth="4" />
            <path d="M22 88 Q50 68 78 88 Z" fill="#1e40af" />
            <path d="M38 78 L50 88 L62 78 Z" fill="#f87171" />
            <circle cx="50" cy="46" r="23" fill="#fed7aa" />
            <path d="M27 42 Q50 18 73 42 Q70 28 50 25 Q30 28 27 42 Z" fill="#78350f" />
            <path d="M27 42 Q32 30 50 32 Q42 36 34 46 Z" fill="#92400e" />
            <circle cx="43" cy="45" r="2.8" fill="#1e293b" />
            <circle cx="57" cy="45" r="2.8" fill="#1e293b" />
            <path d="M45 54 Q50 59 55 54" stroke="#b91c1c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <circle cx="39" cy="50" r="3" fill="#fca5a5" opacity="0.6" />
            <circle cx="61" cy="50" r="3" fill="#fca5a5" opacity="0.6" />
          </svg>
        );

      case 'victoria':
      case 'victoria ai':
        return (
          <svg viewBox="0 0 100 100" width={size} height={size} className="overflow-visible">
            <defs>
              <linearGradient id="bg-vic" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f472b6" />
                <stop offset="100%" stopColor="#db2777" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill="url(#bg-vic)" stroke="#fbcfe8" strokeWidth="4" />
            <path d="M22 88 Q50 68 78 88 Z" fill="#9d174d" />
            <path d="M24 46 Q20 72 32 76" stroke="#fcd34d" strokeWidth="7" fill="none" strokeLinecap="round" />
            <path d="M76 46 Q80 72 68 76" stroke="#fcd34d" strokeWidth="7" fill="none" strokeLinecap="round" />
            <circle cx="50" cy="46" r="22" fill="#fed7aa" />
            <path d="M26 38 Q50 16 74 38 Z" fill="#ec4899" />
            <path d="M24 38 Q50 32 76 38 Q50 42 24 38 Z" fill="#f43f5e" />
            <rect x="34" y="42" width="14" height="9" rx="3" fill="#1e1b4b" stroke="#f472b6" strokeWidth="1.5" />
            <rect x="52" y="42" width="14" height="9" rx="3" fill="#1e1b4b" stroke="#f472b6" strokeWidth="1.5" />
            <line x1="48" y1="46" x2="52" y2="46" stroke="#f472b6" strokeWidth="2" />
            <path d="M46 56 Q50 60 54 56" stroke="#be123c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </svg>
        );

      case 'arthur':
      case 'arthur ai':
        return (
          <svg viewBox="0 0 100 100" width={size} height={size} className="overflow-visible">
            <defs>
              <linearGradient id="bg-art" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill="url(#bg-art)" stroke="#a7f3d0" strokeWidth="4" />
            <path d="M22 88 Q50 68 78 88 Z" fill="#334155" />
            <polygon points="46,75 50,88 54,75" fill="#dc2626" />
            <circle cx="50" cy="48" r="22" fill="#fed7aa" />
            <ellipse cx="50" cy="30" rx="20" ry="14" fill="#573a27" />
            <ellipse cx="50" cy="35" rx="28" ry="5" fill="#3e281b" />
            <rect x="32" y="32" width="36" height="4" fill="#fbbf24" />
            <circle cx="43" cy="46" r="2.5" fill="#1e293b" />
            <circle cx="57" cy="46" r="2.5" fill="#1e293b" />
            <path d="M38 54 Q44 48 50 53 Q56 48 62 54 Q56 59 50 55 Q44 59 38 54 Z" fill="#475569" />
          </svg>
        );

      case 'elena':
      case 'elena ai':
      default:
        return (
          <svg viewBox="0 0 100 100" width={size} height={size} className="overflow-visible">
            <defs>
              <linearGradient id="bg-ele" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill="url(#bg-ele)" stroke="#fde68a" strokeWidth="4" />
            <path d="M22 88 Q50 68 78 88 Z" fill="#0284c7" />
            <circle cx="50" cy="45" r="26" fill="#fde047" />
            <circle cx="50" cy="47" r="21" fill="#fed7aa" />
            <path d="M29 36 Q50 20 71 36" stroke="#0284c7" strokeWidth="6" fill="none" strokeLinecap="round" />
            <path d="M32 38 Q45 28 50 38 Q55 28 68 38 Z" fill="#facc15" />
            <circle cx="43" cy="47" r="2.8" fill="#0369a1" />
            <circle cx="57" cy="47" r="2.8" fill="#0369a1" />
            <path d="M46 56 Q50 60 54 56" stroke="#e11d48" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <circle cx="39" cy="51" r="3" fill="#fca5a5" opacity="0.6" />
            <circle cx="61" cy="51" r="3" fill="#fca5a5" opacity="0.6" />
          </svg>
        );
    }
  };

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      {getAvatarSvg()}
      {hasCrown && (
        <div className="absolute -top-3 -right-2 transform rotate-12 drop-shadow-md">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#fbbf24" stroke="#b45309" strokeWidth="1.5">
            <path d="M2 4l3 12h14l3-12-6 7-4-10-4 10-6-7z" />
          </svg>
        </div>
      )}
    </div>
  );
};
