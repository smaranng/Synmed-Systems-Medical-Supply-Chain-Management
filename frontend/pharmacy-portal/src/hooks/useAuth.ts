import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getToken, clearToken, authService } from '../services/authService';

interface User {
  id: string;
  email: string;
  pharmaID?: string;
  name: string;
  role: string;
  username?: string;
  logo?: string;
  licenseCertificate?: string;
  phone?: string;
  address?: string;
  licenseNumber?: string;
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
  updateUser: (user: User) => void;
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
        const parsedUser = JSON.parse(stored);
        console.log('🔍 Loading user from localStorage:', parsedUser);
        console.log('🆔 User ID:', parsedUser.id);
        console.log('📄 License Certificate:', parsedUser.licenseCertificate);
        setUser(parsedUser);
      } catch (err) {
        console.error('❌ Failed to parse stored user:', err);
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

      console.log('🔍 Login response userData:', userData);
      console.log('🆔 User ID from login:', userData.id);
      console.log('📄 License Certificate from login:', userData.licenseCertificate);

      if (userData.role !== 'pharmacy') {
        clearToken();
        throw new Error('Invalid credentials or not a pharmacy account');
      }

      setIsTransitioning(true);

      const userToStore: User = {
        id: userData.id,
        email: userData.email,
        pharmaID: userData.pharmaID,   // ✅ add this
        name: userData.name,
        role: userData.role,
        username: userData.username,
        logo: userData.logo || undefined,
        licenseCertificate: userData.licenseCertificate || undefined,
        phone: userData.phone || undefined,
        address: userData.address || undefined,
        licenseNumber: userData.licenseNumber || undefined,
        };

      console.log('💾 Saving to localStorage:', userToStore);
      localStorage.setItem('user', JSON.stringify(userToStore));

      await new Promise(resolve => setTimeout(resolve, 2000));

      setUser(userToStore);
      setIsLoading(false);
      setIsTransitioning(false);
      
      console.log('✅ Login successful. User ID for queries:', userToStore.id);
      return userToStore;
    } catch (err: any) {
      const msg = err?.message || 'Login failed';
      console.error('❌ Login error:', msg, err);
      setError(msg);
      setIsLoading(false);
      setIsTransitioning(false);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    console.log('👋 Logging out');
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

  const updateUser = useCallback((updatedUserData: User) => {
    setUser((currentUser) => {
      if (!currentUser) {
        console.log('⚠️ No current user, setting new user');
        localStorage.setItem('user', JSON.stringify(updatedUserData));
        return updatedUserData;
      }
      
      const mergedUser: User = {
        ...currentUser,
        ...updatedUserData,
      };
      
      console.log('🔄 Updating user:');
      console.log('  Before:', currentUser);
      console.log('  Update data:', updatedUserData);
      console.log('  After merge:', mergedUser);
      console.log('  License Certificate:', mergedUser.licenseCertificate);
      
      localStorage.setItem('user', JSON.stringify(mergedUser));
      return mergedUser;
    });
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

  return React.createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};