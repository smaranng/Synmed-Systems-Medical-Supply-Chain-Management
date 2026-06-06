import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService, getToken, clearToken } from '../services/authService';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  username: string;
  phone?: string;
  address?: string | { line1: string; city: string; state: string; pincode: string };
}

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isTransitioning: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  hasRole: (roles: string | string[]) => boolean;
  updateUser: (updatedUser: User) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = getToken();
    
    if (stored && token) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('user');
        clearToken();
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const userData = await authService.login(username, password);
      
      // 1. Start transition mode
      setIsTransitioning(true);
      
      // 2. Persist to storage (user + token already stored by authService)
      localStorage.setItem('user', JSON.stringify(userData));

      // 3. Wait for 2 seconds (loader duration)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 4. Finally set the user, which triggers the App.tsx redirect
      setUser(userData);
      setIsLoading(false);
      setIsTransitioning(false);
      return userData;
    } catch (err: any) {
      const msg = err?.message || 'Login failed';
      setError(msg);
      setIsLoading(false);
      setIsTransitioning(false);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('user');
    clearToken();
    setError(null);
  }, []);

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
    localStorage.setItem('user', JSON.stringify(updatedUser));
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isTransitioning,
    error,
    login,
    logout,
    hasRole,
    updateUser,
  };

  // replace:
  // return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;

  // with:
  return React.createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};