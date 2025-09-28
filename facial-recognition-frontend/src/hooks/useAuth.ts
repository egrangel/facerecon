import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginCredentials, RegisterData } from '../types/api';
import apiClient from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const isAuthenticated = !!user;

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const userData = await apiClient.getCurrentUser();
          setUser(userData);

          // Dispatch auth state change event
          window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: userData }));
        } catch (error) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');

          // Dispatch auth state change event for logout
          window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: null }));
        }
      } else {
        // Dispatch auth state change event for no user
        window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: null }));
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setAuthError(null); // Clear any previous error
    try {
      const response = await apiClient.login(credentials);
      setUser(response.user);

      // Dispatch auth state change event
      window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: response.user }));
    } catch (error: any) {
      setIsLoading(false);

      // Extract error message from the response
      let errorMessage = 'Erro ao fazer login. Verifique suas credenciais.';

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setAuthError(errorMessage);
      throw error;
    }
    setIsLoading(false);
  };

  const register = async (data: RegisterData) => {
    setIsLoading(true);
    try {
      const response = await apiClient.register(data);
      setUser(response.user);

      // Dispatch auth state change event
      window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: response.user }));
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
    setIsLoading(false);
  };

  const logout = () => {
    apiClient.logout();
    setUser(null);

    // Dispatch auth state change event
    window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: null }));
  };

  const refreshUser = async () => {
    try {
      const userData = await apiClient.getCurrentUser();
      setUser(userData);

      // Dispatch auth state change event
      window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: userData }));
    } catch (error) {
      logout();
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    authError,
    login,
    register,
    logout,
    refreshUser,
    clearAuthError,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
};