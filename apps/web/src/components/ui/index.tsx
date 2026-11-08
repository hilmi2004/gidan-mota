import React, { createContext, useContext, useEffect, useId, useState } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileCheck2,
  Flame,
  Info,
  Loader2,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { formatKobo } from '@autodey/shared';
import { useAppStore } from '../../stores/useAppStore';

// ============================================================================
// 0. BRAND LOGO (Gidan Mota — House of Verified Cars)
// ============================================================================
export interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  showTagline?: boolean;
  className?: string;
}

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
        <path
          d="M11 26.5L32 12L53 26.5"
          stroke="#FFFFFF"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M32 16.5L35.2 19.7L32 22.9L28.8 19.7L32 16.5Z" fill="url(#gm-logo-gold)" />
        <path
          d="M16 36.5L21.5 27.5C22.4 26.1 23.9 25.2 25.6 25.2H38.4C40.1 25.2 41.6 26.1 42.5 27.5L48 36.5"
          stroke="#FFFFFF"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12.5 36.5H51.5C52.6 36.5 53.5 37.4 53.5 38.5V44.5C53.5 46.2 52.2 47.5 50.5 47.5H47.5V50C47.5 51.4 46.4 52.5 45 52.5H42.5C41.1 52.5 40 51.4 40 50V47.5H24V50C24 51.4 22.9 52.5 21.5 52.5H19C17.6 52.5 16.5 51.4 16.5 50V47.5H13.5C11.8 47.5 10.5 46.2 10.5 44.5V38.5C10.5 37.4 11.4 36.5 12.5 36.5Z"
          fill="#FFFFFF"
        />
        <rect x="14.5" y="39.5" width="7" height="3.2" rx="1.6" fill="#D97706" />
        <rect x="42.5" y="39.5" width="7" height="3.2" rx="1.6" fill="#D97706" />
        <rect x="25" y="39.8" width="14" height="2.6" rx="1.3" fill="#065F46" />
      </svg>

      {showText && (
        <div className="flex flex-col">
          <div className={`font-bold ${titleClasses} leading-none tracking-tight flex items-center gap-1`}>
            <span className="text-ink">Gidan</span>
            <span className="text-brand-600 dark:text-brand-500">Mota</span>
          </div>
          {showTagline && (
            <span className="text-[10px] font-semibold text-ink-muted tracking-[0.12em] uppercase mt-1 whitespace-nowrap">
              House of Verified Cars
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 1. BUTTON
// ============================================================================
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'amber';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = '',
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const base =
      'inline-flex items-center justify-center gap-2 font-medium rounded-control transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none select-none';

    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm',
      secondary: 'bg-elevated hover:opacity-90 text-ink border border-line',
      outline: 'border border-line bg-surface hover:bg-elevated text-ink',
      ghost: 'bg-transparent hover:bg-elevated text-ink-secondary hover:text-ink',
      danger: 'bg-signal-danger hover:bg-red-700 text-white shadow-sm',
      amber: 'bg-signal-amber hover:bg-amber-700 text-white shadow-sm',
    };

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'min-h-[38px] px-3.5 py-1.5 text-xs',
      md: 'min-h-[44px] px-4 py-2.5 text-sm',
      lg: 'min-h-[50px] px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        {...props}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : leftIcon}
        <span>{children}</span>
        {!loading && rightIcon}
      </button>
    );
  },
);
Button.displayName = 'Button';

// ============================================================================
// 2. INPUT
// ============================================================================
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
  tabular?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { label, helperText, error, leftAddon, rightAddon, tabular = false, className = '', ...props },
    ref,
  ) => {
    const id = useId();
    const inputId = props.id || id;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-ink-secondary">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftAddon && (
            <div className="absolute left-3.5 text-ink-muted flex items-center pointer-events-none text-sm">
              {leftAddon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={Boolean(error)}
            className={`w-full min-h-[44px] rounded-control bg-surface border px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              error ? 'border-signal-danger focus:ring-signal-danger' : 'border-line'
            } ${leftAddon ? 'pl-10' : ''} ${rightAddon ? 'pr-10' : ''} ${
              tabular ? 'tabular-nums font-mono' : ''
            } ${className}`}
            {...props}
          />
          {rightAddon && (
            <div className="absolute right-3.5 text-ink-muted flex items-center text-sm">
              {rightAddon}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-signal-danger flex items-center gap-1" role="alert">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : (
          helperText && <p className="text-xs text-ink-muted">{helperText}</p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

// ============================================================================
// 3. SELECT
// ============================================================================
export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helperText, error, options, className = '', ...props }, ref) => {
    const id = useId();
    const selectId = props.id || id;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-medium text-ink-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`w-full min-h-[44px] appearance-none rounded-control bg-surface border px-3.5 py-2.5 pr-9 text-sm text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              error ? 'border-signal-danger' : 'border-line'
            } ${className}`}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-ink-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        {error ? (
          <p className="text-xs text-signal-danger">{error}</p>
        ) : (
          helperText && <p className="text-xs text-ink-muted">{helperText}</p>
        )}
      </div>
    );
  },
);
Select.displayName = 'Select';

// ============================================================================
// 4. CHIP
// ============================================================================
export interface ChipProps {
  label: string;
  active?: boolean;
  count?: number;
  onClick?: () => void;
  onRemove?: () => void;
}

export const Chip: React.FC<ChipProps> = ({ label, active = false, count, onClick, onRemove }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
        active
          ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
          : 'bg-surface text-ink-secondary border-line hover:border-brand-500 hover:text-ink'
      }`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`px-1.5 py-0.5 rounded-full text-[11px] tabular-nums ${
            active ? 'bg-white/20 text-white' : 'bg-elevated text-ink-muted'
          }`}
        >
          {count}
        </span>
      )}
      {onRemove && (
        <span
          role="button"
          tabIndex={0}
          aria-label={`Remove ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 p-0.5 rounded-full hover:bg-black/10"
        >
          <X className="w-3 h-3" />
        </span>
      )}
    </button>
  );
};

// ============================================================================
// 5. BADGE (Trust, Vehicle & Auction Status Badges)
// ============================================================================
export type BadgeVariant =
  | 'phone_verified'
  | 'id_verified'
  | 'dealer_verified'
  | 'vin_checked'
  | 'customs_reviewed'
  | 'inspected'
  | 'no_reserve'
  | 'reserve_met'
  | 'reserve_not_met'
  | 'live'
  | 'urgent'
  | 'neutral';

export interface BadgeProps {
  variant?: BadgeVariant;
  children?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', children, className = '' }) => {
  const configs: Record<
    BadgeVariant,
    { style: string; icon: React.ReactNode; defaultLabel: string }
  > = {
    phone_verified: {
      style: 'bg-emerald-500/10 text-brand-600 dark:text-brand-500 border-brand-500/20',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      defaultLabel: 'Phone Verified',
    },
    id_verified: {
      style: 'bg-emerald-500/15 text-brand-700 dark:text-brand-500 border-brand-500/30',
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      defaultLabel: 'ID Verified',
    },
    dealer_verified: {
      style: 'bg-brand-600 text-white border-brand-600',
      icon: <Award className="w-3.5 h-3.5" />,
      defaultLabel: 'Verified Dealer',
    },
    vin_checked: {
      style: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/25',
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      defaultLabel: 'VIN Checked',
    },
    customs_reviewed: {
      style: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/25',
      icon: <FileCheck2 className="w-3.5 h-3.5" />,
      defaultLabel: 'Customs Reviewed',
    },
    inspected: {
      style: 'bg-emerald-500/10 text-brand-700 dark:text-brand-500 border-brand-500/25',
      icon: <Sparkles className="w-3.5 h-3.5" />,
      defaultLabel: 'Inspected',
    },
    no_reserve: {
      style: 'bg-brand-600 text-white border-brand-600',
      icon: null,
      defaultLabel: 'No Reserve',
    },
    reserve_met: {
      style: 'bg-emerald-500/15 text-brand-700 dark:text-brand-500 border-brand-500/30',
      icon: <CheckCircle2 className="w-3 h-3" />,
      defaultLabel: 'Reserve Met',
    },
    reserve_not_met: {
      style: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
      icon: null,
      defaultLabel: 'Reserve Not Met',
    },
    live: {
      style: 'bg-red-500/10 text-signal-danger border-red-500/25',
      icon: <span className="w-2 h-2 rounded-full bg-signal-danger animate-pulse" />,
      defaultLabel: 'LIVE AUCTION',
    },
    urgent: {
      style: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
      icon: <Flame className="w-3.5 h-3.5" />,
      defaultLabel: 'Urgent Sale',
    },
    neutral: {
      style: 'bg-elevated text-ink-secondary border-line',
      icon: null,
      defaultLabel: 'Badge',
    },
  };

  const cfg = configs[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.style} ${className}`}
    >
      {cfg.icon}
      <span>{children ?? cfg.defaultLabel}</span>
    </span>
  );
};

// ============================================================================
// 6. CARD
// ============================================================================
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  interactive = false,
  padding = 'md',
  className = '',
  children,
  ...props
}) => {
  const paddings = {
    none: '',
    sm: 'p-3.5',
    md: 'p-5',
    lg: 'p-6',
  };

  return (
    <div
      className={`rounded-card bg-surface border border-line shadow-card ${
        interactive
          ? 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-cardHover hover:border-brand-500/40 active:scale-[0.995] cursor-pointer'
          : ''
      } ${paddings[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

// ============================================================================
// 7. MODAL / MOBILE BOTTOM SHEET
// ============================================================================
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-[2px] p-0 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-full md:max-w-lg rounded-t-2xl md:rounded-card bg-surface border border-line shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-line">
          <div>
            <h3 id="modal-title" className="text-lg font-semibold text-ink">
              {title}
            </h3>
            {description && <p className="text-xs text-ink-secondary mt-0.5">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-control text-ink-muted hover:text-ink hover:bg-elevated"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 max-h-[75vh] overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3.5 bg-elevated/60 border-t border-line">{footer}</div>}
      </div>
    </div>
  );
};

// ============================================================================
// 8. TOAST SYSTEM
// ============================================================================
export interface ToastItem {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message?: string;
}

interface ToastContextValue {
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue>({
  pushToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = (toast: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  };

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 p-4 rounded-card bg-surface border border-line shadow-cardHover"
          >
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />}
            {t.type === 'warning' && <Clock className="w-5 h-5 text-signal-amber shrink-0 mt-0.5" />}
            {t.type === 'error' && <AlertCircle className="w-5 h-5 text-signal-danger shrink-0 mt-0.5" />}
            {t.type === 'info' && <Info className="w-5 h-5 text-signal-info shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">{t.title}</p>
              {t.message && <p className="text-xs text-ink-secondary mt-0.5">{t.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="text-ink-muted hover:text-ink"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// ============================================================================
// 9. TABS
// ============================================================================
export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange }) => {
  return (
    <div
      role="tablist"
      className="inline-flex items-center gap-1 p-1 rounded-control bg-elevated border border-line overflow-x-auto max-w-full"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`min-h-[38px] px-4 py-1.5 rounded-[6px] text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              active
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className="px-1.5 py-0.5 text-[11px] rounded-full bg-brand-500/15 text-brand-600 tabular-nums">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// ============================================================================
// 10. SKELETON
// ============================================================================
export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-5 w-full' }) => (
  <div className={`animate-pulse rounded-control bg-elevated ${className}`} />
);

// ============================================================================
// 11. AVATAR
// ============================================================================
export interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  verified?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ name, src, size = 'md', verified = false }) => {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-16 h-16 text-lg',
  };
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative inline-flex shrink-0">
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizes[size]} rounded-full object-cover border border-line`}
        />
      ) : (
        <div
          className={`${sizes[size]} rounded-full bg-brand-600/15 text-brand-700 dark:text-brand-500 border border-brand-500/30 font-semibold flex items-center justify-center`}
        >
          {initials || 'AD'}
        </div>
      )}
      {verified && (
        <span
          title="Verified Member"
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-brand-600 text-white flex items-center justify-center ring-2 ring-surface"
        >
          <CheckCircle2 className="w-3 h-3" />
        </span>
      )}
    </div>
  );
};

// ============================================================================
// 12. COUNTDOWN (Server-Clock-Synced Tabular Auction Timer)
// ============================================================================
export interface CountdownProps {
  endsAt: string | Date;
  size?: 'sm' | 'md' | 'lg';
}

export const Countdown: React.FC<CountdownProps> = ({ endsAt, size = 'md' }) => {
  const serverClockOffsetMs = useAppStore((s) => s.serverClockOffsetMs);
  const targetMs = new Date(endsAt).getTime();

  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, targetMs - (Date.now() + serverClockOffsetMs)),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const nowServer = Date.now() + serverClockOffsetMs;
      setRemainingMs(Math.max(0, targetMs - nowServer));
    }, 1000);
    return () => clearInterval(timer);
  }, [targetMs, serverClockOffsetMs]);

  if (remainingMs <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-xs font-semibold text-ink-muted">
        Auction Ended
      </span>
    );
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const isCritical = remainingMs <= 5 * 60 * 1000; // < 5 mins
  const isUrgent = !isCritical && remainingMs <= 60 * 60 * 1000; // < 1 hour

  const formatted =
    days > 0
      ? `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`
      : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const colorClasses = isCritical
    ? 'text-signal-danger bg-red-500/10 border-red-500/30 animate-pulse'
    : isUrgent
      ? 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30'
      : 'text-ink bg-elevated border-line';

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3.5 py-1.5 text-base',
  };

  return (
    <span
      aria-live="off"
      className={`inline-flex items-center gap-1.5 rounded-control border font-mono tabular-nums font-semibold ${colorClasses} ${sizeClasses[size]}`}
    >
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>{formatted}</span>
    </span>
  );
};

// ============================================================================
// 13. PRICE TAG (Integer Kobo -> Tabular NGN)
// ============================================================================
export interface PriceTagProps {
  kobo: number;
  compact?: boolean;
  negotiable?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const PriceTag: React.FC<PriceTagProps> = ({
  kobo,
  compact = false,
  negotiable = false,
  size = 'md',
  className = '',
}) => {
  const sizes = {
    sm: 'text-sm font-semibold',
    md: 'text-lg font-bold',
    lg: 'text-2xl font-bold',
    xl: 'text-3xl md:text-4xl font-bold tracking-tight',
  };

  return (
    <div className={`inline-flex items-baseline gap-2 ${className}`}>
      <span
        aria-live="polite"
        className={`tabular-nums font-sans text-ink ${sizes[size]}`}
      >
        {formatKobo(kobo, { compact })}
      </span>
      {negotiable && (
        <span className="text-[11px] font-medium text-ink-secondary bg-elevated px-2 py-0.5 rounded-full">
          Negotiable
        </span>
      )}
    </div>
  );
};

// ============================================================================
// 14. EMPTY STATE
// ============================================================================
export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 md:p-12 rounded-card bg-surface border border-dashed border-line">
      <div className="w-12 h-12 rounded-full bg-elevated text-ink-secondary flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="text-sm text-ink-secondary max-w-md mt-1 mb-5">{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

