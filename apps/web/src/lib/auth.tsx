import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi, clearToken, saveToken, type User } from './api';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string, register?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.me().then(setUser).catch(() => { clearToken(); setUser(null); }).finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    signIn: async (email, password, register = false) => {
      const result = register ? await authApi.register(email, password) : await authApi.login(email, password);
      saveToken(result.accessToken);
      setUser(result.user);
    },
    signOut: async () => {
      try { await authApi.logout(); } finally { clearToken(); setUser(null); }
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
