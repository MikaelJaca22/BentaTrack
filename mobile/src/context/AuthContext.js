import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import client, { setOnUnauthorized } from '../api/client.js';
import { loadToken, saveToken, clearToken } from '../api/tokenStore.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function signOut() {
    await clearToken();
    setUser(null);
  }

  // Restore session on boot.
  useEffect(() => {
    setOnUnauthorized(() => {
      signOut();
    });
    (async () => {
      const token = await loadToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await client.get('/auth/me');
        setUser(res.data.user);
      } catch {
        await clearToken();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await client.post('/auth/login', { username, password });
    await saveToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await client.post('/auth/register', payload);
    await saveToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
