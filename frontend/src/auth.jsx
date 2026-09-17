import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api('/auth/me')
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      async register(payload) {
        const data = await api('/auth/register', { method: 'POST', body: payload });
        setUser(data.user);
        return data.user;
      },
      async login(payload) {
        const data = await api('/auth/login', { method: 'POST', body: payload });
        setUser(data.user);
        return data.user;
      },
      async logout() {
        try {
          await api('/auth/logout', { method: 'POST' });
        } catch {
          /* signed out locally even if the request fails */
        }
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
