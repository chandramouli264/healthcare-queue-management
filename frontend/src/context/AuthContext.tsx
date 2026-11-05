import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { TOKEN_KEY } from '../services/api';
import { authService } from '../services';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (body: object) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const me = await authService.me();
    setUser({
      id: me.id, email: me.email, firstName: me.firstName, lastName: me.lastName, phone: me.phone,
      role: me.role, isActive: me.isActive, doctorId: me.doctorId, patientId: me.patientId,
    });
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    refresh().catch(logout).finally(() => setLoading(false));
  }, [token, refresh, logout]);

  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener('hqms:unauthorized', onUnauthorized);
    return () => window.removeEventListener('hqms:unauthorized', onUnauthorized);
  }, [logout]);

  const persist = (t: string, u: User) => {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
    return u;
  };

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      loading,
      login: async (email, password) => {
        const { data } = await authService.login(email, password);
        return persist(data.token, data.user);
      },
      register: async (body) => {
        const { data } = await authService.register(body);
        return persist(data.token, data.user);
      },
      logout,
      refresh,
    }),
    [user, token, loading, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
