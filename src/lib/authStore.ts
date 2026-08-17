import { create } from 'zustand';
import { api, type SessionUser } from './api';
import { clearStateCache, flushNow } from './syncStorage';

interface AuthState {
  user: SessionUser | null;
  setUser: (user: SessionUser | null) => void;
  logout: () => Promise<void>;
}

/** Session identity. Deliberately not persisted — the cookie is the source of truth. */
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,

  setUser: (user) => set({ user }),

  logout: async () => {
    // Push anything still queued before the session goes away.
    flushNow();
    try {
      await api.post('/api/auth/logout');
    } finally {
      clearStateCache();
      set({ user: null });
      // A full reload drops every hydrated store, so the next account cannot
      // inherit the previous one's widgets.
      window.location.reload();
    }
  },
}));
