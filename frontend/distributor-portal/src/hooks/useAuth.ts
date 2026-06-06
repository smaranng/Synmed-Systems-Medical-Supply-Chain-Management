import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService, getToken, clearToken, clearDriverToken, getDriverToken } from '../services/authService';

interface User {
  id: string;
  name: string;
  role: string;          // 'distributor' | 'driver'
  username: string;
  email?: string;
  phone?: string;
  address?: string | { line1: string; city: string; state: string; pincode: string };
  // Distributor-only fields
  companyName?: string;
  licenseNumber?: string;
  revenue?: number;
  licenseCertificate?: string;
  gstIN?: string;
  gstRegistered?: boolean;
  logo?: string;
  // Driver-only fields
  distributorID?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  isActive?: boolean;
}

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  hasRole: (roles: string | string[]) => boolean;
  updateUser: (updatedUser: User) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY   = 'distributor_user';
const DRIVER_STORAGE_KEY = 'driver_user';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodeTokenPayload(token: string): Record<string, any> | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) return true;
  return Date.now() / 1000 > payload.exp;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]           = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // ── Session restoration on mount ────────────────────────────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      // 1. Try driver token first
      const driverToken = getDriverToken();
      if (driverToken && !isTokenExpired(driverToken)) {
        const payload  = decodeTokenPayload(driverToken);
        const driverID = payload?.userId;

        try {
          const res  = await fetch(`http://localhost:5203/driver/${driverID}`, {
            headers: { Authorization: `Bearer ${driverToken}` },
          });
          const data = await res.json();

          if (data.driverID) {
            const freshDriver: User = {
              id:            data.driverID,
              name:          data.name,
              username:      data.username,
              role:          'driver',
              phone:         data.phone,
              distributorID: data.distributorID,
              vehicleNumber: data.vehicleNumber || null,
              vehicleType:   data.vehicleType   || null,
              isActive:      data.isActive,
            };
            setUser(freshDriver);
            localStorage.setItem(DRIVER_STORAGE_KEY, JSON.stringify(freshDriver));
            setIsLoading(false);
            return;
          }
        } catch {
          // Network failed — fall back to cached driver
          const cached = localStorage.getItem(DRIVER_STORAGE_KEY);
          if (cached) {
            try {
              setUser(JSON.parse(cached));
              setIsLoading(false);
              return;
            } catch { /* corrupted, continue */ }
          }
        }

        // Token invalid/expired — clear it
        clearDriverToken();
        localStorage.removeItem(DRIVER_STORAGE_KEY);
      }

      // 2. Try distributor token
      const distToken = getToken();
      if (distToken && !isTokenExpired(distToken)) {
        const payload       = decodeTokenPayload(distToken);
        const distributorID = payload?.userId;

        try {
          const res  = await fetch(`http://localhost:5203/distributor/${distributorID}`);
          const data = await res.json();

          if (data.distributorID) {
            const freshUser: User = {
              id:                 data.distributorID,
              name:               data.name,
              email:              data.email,
              username:           data.username || '',
              role:               'distributor',
              phone:              data.phone,
              address:            data.address,
              companyName:        data.companyName,
              licenseNumber:      data.licenseNumber,
              licenseCertificate: data.licenseCertificate || null,
              logo:               data.logo || null,
              gstRegistered:      data.gstRegistered,
              gstIN:              data.gstIN,
            };
            setUser(freshUser);
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(freshUser));
            setIsLoading(false);
            return;
          }
        } catch {
          // Network failed — fall back to cached distributor
          const cached = localStorage.getItem(USER_STORAGE_KEY);
          if (cached) {
            try {
              setUser(JSON.parse(cached));
              setIsLoading(false);
              return;
            } catch { /* corrupted, continue */ }
          }
        }

        // Token invalid/expired — clear it
        clearToken();
        localStorage.removeItem(USER_STORAGE_KEY);
      }

      // 3. No valid session
      setIsLoading(false);
    };

    restoreSession();
  }, []);

  // ── Distributor login ────────────────────────────────────────────────────────
  const login = useCallback(async (username: string, password: string): Promise<User> => {
    setError(null);
    const userData = await authService.login(username, password) as User;
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
    setUser(userData);
    return userData;
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    setUser(null);
    clearToken();
    clearDriverToken();
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(DRIVER_STORAGE_KEY);
    setError(null);
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const hasRole = useCallback(
    (roles: string | string[]) => {
      if (!user) return false;
      const target = Array.isArray(roles) ? roles : [roles];
      return target.includes(user.role);
    },
    [user]
  );

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    const key = updatedUser.role === 'driver' ? DRIVER_STORAGE_KEY : USER_STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(updatedUser));
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    logout,
    hasRole,
    updateUser,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};