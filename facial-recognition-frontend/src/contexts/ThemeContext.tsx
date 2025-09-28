import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Theme, ThemeContextType } from '../types/theme';
import { predefinedThemes } from '../config/themes';
import { apiClient } from '../services/api';
import { User } from '../types/api';

const THEME_STORAGE_KEY = 'facerecon-theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setCurrentTheme] = useState<Theme>(predefinedThemes[0]);
  const [themes, setThemes] = useState<Theme[]>(predefinedThemes);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Load theme on component mount and when user changes
  const loadTheme = async (currentUser?: User | null) => {
    try {
      let themeId: string | null = null;

      // Priority 1: Get theme from user preferences if logged in
      if (currentUser?.preferences) {
        try {
          const preferences = JSON.parse(currentUser.preferences);
          themeId = preferences.themeId;
        } catch (error) {
          console.warn('Error parsing user preferences:', error);
        }
      }

      // Priority 2: Fallback to localStorage for guest users or if no user preference
      if (!themeId) {
        themeId = localStorage.getItem(THEME_STORAGE_KEY);
      }

      // Find and apply theme
      if (themeId) {
        const savedTheme = predefinedThemes.find(t => t.id === themeId);
        if (savedTheme) {
          setCurrentTheme(savedTheme);
          applyThemeToDOM(savedTheme);
        } else {
          // Theme not found, apply default
          setCurrentTheme(predefinedThemes[0]);
          applyThemeToDOM(predefinedThemes[0]);
        }
      } else {
        // Apply default theme
        setCurrentTheme(predefinedThemes[0]);
        applyThemeToDOM(predefinedThemes[0]);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
      // Apply default theme on error
      setCurrentTheme(predefinedThemes[0]);
      applyThemeToDOM(predefinedThemes[0]);
    } finally {
      setIsLoading(false);
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    const handleAuthChange = (event: CustomEvent) => {
      const userData = event.detail;

      // If user is null (logout), clear localStorage theme cache
      if (!userData) {
        localStorage.removeItem(THEME_STORAGE_KEY);
      }

      setUser(userData);
      // Use setTimeout to ensure this runs after the current execution stack
      setTimeout(() => loadTheme(userData), 0);
    };

    const handleUserUpdate = (event: CustomEvent) => {
      const userData = event.detail;
      setUser(userData);
      // Use setTimeout to ensure this runs after the current execution stack
      setTimeout(() => loadTheme(userData), 0);
    };

    // Listen for custom auth events
    window.addEventListener('auth-state-changed', handleAuthChange as EventListener);
    window.addEventListener('user-updated', handleUserUpdate as EventListener);

    // Initial load - delay to allow auth provider to initialize
    setTimeout(() => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        apiClient.getCurrentUser()
          .then(userData => {
            setUser(userData);
            loadTheme(userData);
          })
          .catch(() => {
            setUser(null);
            loadTheme(null);
          });
      } else {
        setUser(null);
        loadTheme(null);
      }
    }, 100); // Small delay to let auth provider initialize

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthChange as EventListener);
      window.removeEventListener('user-updated', handleUserUpdate as EventListener);
    };
  }, []);

  // Apply theme variables to CSS custom properties
  const applyThemeToDOM = (newTheme: Theme) => {
    const root = document.documentElement;

    // Primary colors
    Object.entries(newTheme.colors.primary).forEach(([key, value]) => {
      root.style.setProperty(`--color-primary-${key}`, value);
    });

    // Secondary colors
    Object.entries(newTheme.colors.secondary).forEach(([key, value]) => {
      root.style.setProperty(`--color-secondary-${key}`, value);
    });

    // Background colors
    Object.entries(newTheme.colors.background).forEach(([key, value]) => {
      root.style.setProperty(`--color-background-${key}`, value);
    });

    // Text colors
    Object.entries(newTheme.colors.text).forEach(([key, value]) => {
      root.style.setProperty(`--color-text-${key}`, value);
    });

    // Border colors
    Object.entries(newTheme.colors.border).forEach(([key, value]) => {
      root.style.setProperty(`--color-border-${key}`, value);
    });

    // Status colors
    Object.entries(newTheme.colors.status).forEach(([status, colors]) => {
      Object.entries(colors).forEach(([key, value]) => {
        root.style.setProperty(`--color-status-${status}-${key}`, value);
      });
    });

    // Typography
    root.style.setProperty('--font-family-sans', newTheme.typography.fontFamily.sans.join(', '));
    root.style.setProperty('--font-family-mono', newTheme.typography.fontFamily.mono.join(', '));

    Object.entries(newTheme.typography.fontSize).forEach(([key, value]) => {
      root.style.setProperty(`--font-size-${key}`, value);
    });

    Object.entries(newTheme.typography.fontWeight).forEach(([key, value]) => {
      root.style.setProperty(`--font-weight-${key}`, value.toString());
    });

    Object.entries(newTheme.typography.lineHeight).forEach(([key, value]) => {
      root.style.setProperty(`--line-height-${key}`, value.toString());
    });

    // Spacing
    Object.entries(newTheme.spacing.borderRadius).forEach(([key, value]) => {
      root.style.setProperty(`--border-radius-${key}`, value);
    });

    Object.entries(newTheme.spacing.spacing).forEach(([key, value]) => {
      root.style.setProperty(`--spacing-${key}`, value);
    });

    Object.entries(newTheme.spacing.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--shadow-${key}`, value);
    });
  };

  const setTheme = async (themeId: string) => {
    const newTheme = themes.find(t => t.id === themeId);
    if (newTheme) {
      setCurrentTheme(newTheme);
      applyThemeToDOM(newTheme);

      // Save theme preference
      if (user) {
        try {
          // Update user preferences on server
          let preferences = {};
          if (user.preferences) {
            try {
              preferences = JSON.parse(user.preferences);
            } catch (error) {
              console.warn('Error parsing existing preferences:', error);
            }
          }

          preferences = { ...preferences, themeId };
          const updatedPreferences = JSON.stringify(preferences);

          const updatedUser = await apiClient.updateCurrentUser({
            preferences: updatedPreferences
          });

          // Update local user state
          setUser(updatedUser);

          // Dispatch custom event to notify other components
          window.dispatchEvent(new CustomEvent('user-updated', { detail: updatedUser }));
        } catch (error) {
          console.error('Error saving theme preference to user:', error);
          // Fallback to localStorage if server update fails
          localStorage.setItem(THEME_STORAGE_KEY, themeId);
        }
      } else {
        // Save to localStorage for guest users
        localStorage.setItem(THEME_STORAGE_KEY, themeId);
      }
    }
  };

  const createCustomTheme = (customTheme: Partial<Theme>) => {
    const newTheme: Theme = {
      id: customTheme.id || `custom-${Date.now()}`,
      name: customTheme.name || 'Custom Theme',
      colors: { ...theme.colors, ...customTheme.colors },
      typography: { ...theme.typography, ...customTheme.typography },
      spacing: { ...theme.spacing, ...customTheme.spacing },
    };

    setThemes(prev => [...prev, newTheme]);
    setTheme(newTheme.id);
  };

  const value: ThemeContextType = {
    theme,
    themes,
    setTheme,
    createCustomTheme,
    isLoading,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};