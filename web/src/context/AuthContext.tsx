import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import client from '../api/client';
import type { AuthUser } from '../api/types';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthState>(null as unknown as AuthState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('mes_token');
    if (!token) {
      setLoading(false);
      return;
    }
    client
      .get('/auth/me')
      .then((r) => setUser(r.data.user))
      .catch(() => localStorage.removeItem('mes_token'))
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const r = await client.post('/auth/login', { username, password });
    localStorage.setItem('mes_token', r.data.token);
    setUser(r.data.user);
  }

  function logout() {
    localStorage.removeItem('mes_token');
    setUser(null);
  }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
