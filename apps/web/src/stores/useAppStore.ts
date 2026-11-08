import { create } from 'zustand';
import type { UserRole, UserVerificationBadges } from '@autodey/shared';

export interface AuthUser {
  id: string;
  phone: string;
  phoneMasked: string;
  email?: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  state?: string;
  lga?: string;
  whatsappNumber?: string;
  roles: UserRole[];
  verification: UserVerificationBadges;
  strikes: number;
}

interface AppState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  theme: 'light' | 'dark';
  dataSaver: boolean;
  serverClockOffsetMs: number;
  setSession: (payload: { accessToken: string; refreshToken?: string; user: AuthUser }) => void;
  updateUser: (partial: Partial<AuthUser>) => void;
  clearSession: () => void;
  toggleTheme: () => void;
  toggleDataSaver: () => void;
  setServerClockOffset: (serverTimeMs: number) => void;
}

const savedTheme =
  (typeof window !== 'undefined' && (localStorage.getItem('autodey_theme') as 'light' | 'dark')) ||
  'light';
const savedDataSaver =
  typeof window !== 'undefined' && localStorage.getItem('autodey_datasaver') === 'true';
const savedToken =
  typeof window !== 'undefined' ? localStorage.getItem('autodey_access_token') : null;
const savedRefresh =
  typeof window !== 'undefined' ? localStorage.getItem('autodey_refresh_token') : null;
const savedUserRaw =
  typeof window !== 'undefined' ? localStorage.getItem('autodey_user') : null;

if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('dark', savedTheme === 'dark');
}

export const useAppStore = create<AppState>((set) => ({
  accessToken: savedToken,
  refreshToken: savedRefresh,
  user: savedUserRaw ? (JSON.parse(savedUserRaw) as AuthUser) : null,
  theme: savedTheme,
  dataSaver: savedDataSaver,
  serverClockOffsetMs: 0,

  setSession: ({ accessToken, refreshToken, user }) => {
    localStorage.setItem('autodey_access_token', accessToken);
    if (refreshToken) {
      localStorage.setItem('autodey_refresh_token', refreshToken);
    }
    localStorage.setItem('autodey_user', JSON.stringify(user));
    set((state) => ({
      accessToken,
      refreshToken: refreshToken ?? state.refreshToken,
      user,
    }));
  },

  updateUser: (partial) =>
    set((state) => {
      if (!state.user) return state;
      const updated = { ...state.user, ...partial };
      localStorage.setItem('autodey_user', JSON.stringify(updated));
      return { user: updated };
    }),

  clearSession: () => {
    localStorage.removeItem('autodey_access_token');
    localStorage.removeItem('autodey_refresh_token');
    localStorage.removeItem('autodey_user');
    set({ accessToken: null, refreshToken: null, user: null });
  },

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('autodey_theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      return { theme: next };
    }),

  toggleDataSaver: () =>
    set((state) => {
      const next = !state.dataSaver;
      localStorage.setItem('autodey_datasaver', String(next));
      return { dataSaver: next };
    }),

  setServerClockOffset: (serverTimeMs: number) =>
    set({ serverClockOffsetMs: serverTimeMs - Date.now() }),
}));

