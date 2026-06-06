import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';  // tiny lib bundled with expo
import { loginDriver as apiLogin, fetchDriverProfile, clearToken, getToken } from '../api/api';
import type { Driver } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  driver: Driver | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  driver: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  refreshProfile: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on app launch
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;

        // Decode to get driverID without an extra network call
        const payload = jwtDecode<{ userId: string }>(token);
        if (!payload?.userId) return;

        const profile = await fetchDriverProfile(payload.userId);
        setDriver(profile);
      } catch {
        // Token expired or invalid — clear it silently
        await clearToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const profile = await apiLogin(username, password);
    setDriver(profile);
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setDriver(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!driver?.driverID) return;
    const updated = await fetchDriverProfile(driver.driverID);
    setDriver(updated);
  }, [driver?.driverID]);

  return (
    <AuthContext.Provider value={{ driver, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
