import React from 'react';

export const CharacterAvatar: React.FC<{
  character: 'You' | 'Victoria' | 'Arthur' | 'Elena' | string;
  color: string;
  size?: number;
  hasCrown?: boolean;
}> = ({ character, color, size = 44, hasCrown = false }) => {
  // Identity comes from the player, not the portrait's character name.
  const gradientId = `avatar-${React.useId()}`;
  const light = `color-mix(in srgb, ${color} 72%, white)`;
  const dark = `color-mix(in srgb, ${color} 78%, black)`;
  const clothing = `color-mix(in srgb, ${color} 65%, black)`;
  const gradient = <defs><linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stopColor={light} />
    <stop offset="100%" stopColor={dark} />
  </linearGradient></defs>;
  const portraitBackground = <circle cx="50" cy="50" r="46" fill={`url(#${gradientId})`} stroke={color} strokeWidth="4" />;
  const getAvatarSvg = () => {
    switch (character.toLowerCase()) {
      case 'you':
      case 'you (tycoon)':
        // Smiling boy with brown hair
        return (
          <svg viewBox="0 0 100 100" width={size} height={size} className="overflow-visible">
            {gradient}
            {portraitBackground}
            {/* Body / Shirt */}
            <path d="M22 88 Q50 68 78 88 Z" fill={clothing} />
            <path d="M38 78 L50 88 L62 78 Z" fill={light} />
            {/* Head & Neck */}
            <circle cx="50" cy="46" r="23" fill="#fed7aa" />
            {/* Hair */}
            <path d="M27 42 Q50 18 73 42 Q70 28 50 25 Q30 28 27 42 Z" fill="#78350f" />
            <path d="M27 42 Q32 30 50 32 Q42 36 34 46 Z" fill="#92400e" />
            {/* Eyes & Smile */}
            <circle cx="43" cy="45" r="2.8" fill="#1e293b" />
            <circle cx="57" cy="45" r="2.8" fill="#1e293b" />
            <path d="M45 54 Q50 59 55 54" stroke="#b91c1c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            {/* Cheeks */}
            <circle cx="39" cy="50" r="3" fill="#fca5a5" opacity="0.6" />
            <circle cx="61" cy="50" r="3" fill="#fca5a5" opacity="0.6" />
          </svg>
        );

      case 'victoria':
      case 'victoria ai':
        // Cool girl with pink cap, stylish sunglasses and pink jacket
        return (
          <svg viewBox="0 0 100 100" width={size} height={size} className="overflow-visible">
            {gradient}
            {portraitBackground}
            {/* Body */}
            <path d="M22 88 Q50 68 78 88 Z" fill={clothing} />
            {/* Blonde Hair below cap */}
            <path d="M24 46 Q20 72 32 76" stroke="#fcd34d" strokeWidth="7" fill="none" strokeLinecap="round" />
            <path d="M76 46 Q80 72 68 76" stroke="#fcd34d" strokeWidth="7" fill="none" strokeLinecap="round" />
            {/* Face */}
            <circle cx="50" cy="46" r="22" fill="#fed7aa" />
            {/* Pink Cap */}
            <path d="M26 38 Q50 16 74 38 Z" fill="#ec4899" />
            <path d="M24 38 Q50 32 76 38 Q50 42 24 38 Z" fill="#f43f5e" />
            {/* Cool Sunglasses */}
            <rect x="34" y="42" width="14" height="9" rx="3" fill="#1e1b4b" stroke="#f472b6" strokeWidth="1.5" />
            <rect x="52" y="42" width="14" height="9" rx="3" fill="#1e1b4b" stroke="#f472b6" strokeWidth="1.5" />
            <line x1="48" y1="46" x2="52" y2="46" stroke="#f472b6" strokeWidth="2" />
            {/* Smile */}
            <path d="M46 56 Q50 60 54 56" stroke="#be123c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </svg>
        );

      case 'arthur':
      case 'arthur ai':
        // Smart boy with dark hair and glasses
        return (
          <svg viewBox="0 0 100 100" width={size} height={size} className="overflow-visible">
            {gradient}
            {portraitBackground}
            {/* Sweater */}
            <path d="M22 88 Q50 68 78 88 Z" fill={clothing} />
            <path d="M38 78 L50 88 L62 78 Z" fill={light} />
            {/* Face */}
            <circle cx="50" cy="46" r="23" fill="#fed7aa" />
            {/* Dark Hair */}
            <path d="M26 42 Q50 18 74 42 Q70 26 50 24 Q30 26 26 42 Z" fill="#1e293b" />
            {/* Eyes */}
            <circle cx="42" cy="46" r="2.8" fill="#1e293b" />
            <circle cx="58" cy="46" r="2.8" fill="#1e293b" />
            {/* Round Glasses */}
            <circle cx="42" cy="46" r="8" fill="none" stroke="#0f172a" strokeWidth="2.5" />
            <circle cx="58" cy="46" r="8" fill="none" stroke="#0f172a" strokeWidth="2.5" />
            <line x1="50" y1="46" x2="50" y2="46" stroke="#0f172a" strokeWidth="2.5" />
            {/* Smile */}
            <path d="M45 57 Q50 61 55 57" stroke="#b91c1c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            {/* Cheeks */}
            <circle cx="36" cy="52" r="3" fill="#fca5a5" opacity="0.6" />
            <circle cx="64" cy="52" r="3" fill="#fca5a5" opacity="0.6" />
          </svg>
        );

      case 'elena':
      case 'elena ai':
      default:
        // Cute blonde girl with golden hair
        return (
          <svg viewBox="0 0 100 100" width={size} height={size} className="overflow-visible">
            {gradient}
            {portraitBackground}
            {/* Sweater */}
            <path d="M22 88 Q50 68 78 88 Z" fill={clothing} />
            <path d="M38 78 L50 88 L62 78 Z" fill={light} />
            {/* Blonde Hair */}
            <circle cx="50" cy="45" r="26" fill="#facc15" />
            {/* Face */}
            <circle cx="50" cy="47" r="21" fill="#fed7aa" />
            {/* Hair bangs */}
            <path d="M28 40 Q40 28 50 38 Q60 28 72 40 Z" fill="#eab308" />
            {/* Eyes */}
            <circle cx="43" cy="47" r="2.8" fill="#0369a1" />
            <circle cx="57" cy="47" r="2.8" fill="#0369a1" />
            {/* Smile */}
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
