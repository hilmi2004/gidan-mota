import React from 'react';

export interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  showTagline?: boolean;
  className?: string;
}

/**
 * Gidan Mota ("House of Cars") Signature Emblem & Wordmark
 *
 * Combines:
 * - "Gidan" (Architectural showroom gable + Northern Nigerian geometric gold keystone)
 * - "Mota" (Precision front-facing coupe/SUV silhouette with twin amber DRL headlights)
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showText = true,
  showTagline = true,
  className = '',
}) => {
  const iconDimensions = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  }[size];

  const titleClasses = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
  }[size];

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconDimensions} shrink-0 drop-shadow-sm transition-transform duration-200 group-hover:scale-[1.03]`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="gm-logo-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#065F46" />
            <stop offset="55%" stopColor="#059669" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
          <linearGradient id="gm-logo-gold" x1="16" y1="10" x2="48" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>

        {/* Outer Sovereign Squircle Shield */}
        <rect x="2" y="2" width="60" height="60" rx="15" fill="url(#gm-logo-bg)" />
        <rect
          x="3.5"
          y="3.5"
          width="57"
          height="57"
          rx="13.5"
          stroke="#FFFFFF"
          strokeOpacity="0.2"
          strokeWidth="1.2"
        />

        {/* "Gidan" Architectural Roofline + Gold Keystone */}
        <path
          d="M11 26.5L32 12L53 26.5"
          stroke="#FFFFFF"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M32 16.5L35.2 19.7L32 22.9L28.8 19.7L32 16.5Z" fill="url(#gm-logo-gold)" />

        {/* "Mota" Cabin & Fastback Roofline */}
        <path
          d="M16 36.5L21.5 27.5C22.4 26.1 23.9 25.2 25.6 25.2H38.4C40.1 25.2 41.6 26.1 42.5 27.5L48 36.5"
          stroke="#FFFFFF"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Lower Bumper & Wide Stance Chassis */}
        <path
          d="M12.5 36.5H51.5C52.6 36.5 53.5 37.4 53.5 38.5V44.5C53.5 46.2 52.2 47.5 50.5 47.5H47.5V50C47.5 51.4 46.4 52.5 45 52.5H42.5C41.1 52.5 40 51.4 40 50V47.5H24V50C24 51.4 22.9 52.5 21.5 52.5H19C17.6 52.5 16.5 51.4 16.5 50V47.5H13.5C11.8 47.5 10.5 46.2 10.5 44.5V38.5C10.5 37.4 11.4 36.5 12.5 36.5Z"
          fill="#FFFFFF"
        />

        {/* Twin Amber DRL Headlights */}
        <rect x="14.5" y="39.5" width="7" height="3.2" rx="1.6" fill="#D97706" />
        <rect x="42.5" y="39.5" width="7" height="3.2" rx="1.6" fill="#D97706" />

        {/* Center Emerald Grille */}
        <rect x="25" y="39.8" width="14" height="2.6" rx="1.3" fill="#065F46" />
      </svg>

      {showText && (
        <div className="flex flex-col">
          <div className={`font-bold ${titleClasses} leading-none tracking-tight flex items-center gap-1`}>
            <span className="text-ink">Gidan</span>
            <span className="text-brand-600 dark:text-brand-500">Mota</span>
          </div>
          {showTagline && (
            <span className="hidden sm:block text-[10px] font-semibold text-ink-muted tracking-[0.12em] uppercase mt-1 whitespace-nowrap">
              House of Verified Cars
            </span>
          )}
        </div>
      )}
    </div>
  );
};

