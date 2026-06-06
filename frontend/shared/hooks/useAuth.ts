import { useState, useEffect, useCallback } from 'react';
import { User, LoginCredentials, AuthResult } from '../types/user';
import { STORAGE_KEYS } from '../utils/constants';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);

    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error('Failed to parse stored user:', err);
        localStorage.removeItem(STORAGE_KEYS.USER);
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // This would be replaced with actual API call
      // const response = await authAPI.login(credentials);
      // Mock response for now
      const mockAuthResult: AuthResult = {
        user: {
          id: '1',
          email: credentials.email,
          role: credentials.role,
          firstName: 'John',
          lastName: 'Doe',
          isActive: true,
          isVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };

      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(mockAuthResult.user));
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, mockAuthResult.accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, mockAuthResult.refreshToken);

      setUser(mockAuthResult.user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
  }, []);

  return {
    user,
    loading,
    error,
    login,
    logout,
    updateUser,
    isAuthenticated: !!user,
  };
};
