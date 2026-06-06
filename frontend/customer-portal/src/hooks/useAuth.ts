import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';

interface Address {
  line1: string;
  city: string;
  state: string;
  pincode: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  username: string;
  phone?: string;
  address?: Address;
  location?: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
}

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  hasRole: (roles: string | string[]) => boolean;
  updateUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔐 Initialize user from token + localStorage
  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = authService.getToken();
    
    if (stored && token) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('user');
        authService.clearToken();
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setError(null);
    try {
      const userData = await authService.login(username, password);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return userData;
    } catch (err: any) {
      const msg = err?.message || 'Invalid username or password';
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('user');
    authService.clearToken(); // 🔐 Clear JWT token
    setError(null);
  }, []);

  const updateUser = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const hasRole = useCallback(
    (roles: string | string[]) => {
      if (!user) return false;
      const target = Array.isArray(roles) ? roles : [roles];
      return target.includes(user.role);
    },
    [user]
  );

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    logout,
    hasRole,
    updateUser
  };

  return React.createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};