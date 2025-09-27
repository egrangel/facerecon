import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Theme, ThemeContextType } from '../types/theme';
import { predefinedThemes } from '../config/themes';

const THEME_STORAGE_KEY = 'facerecon-theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setCurrentTheme] = useState<Theme>(predefinedThemes[0]);
  const [themes, setThemes] = useState<Theme[]>(predefinedThemes);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from localStorage on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedThemeId = localStorage.getItem(THEME_STORAGE_KEY);
        if (savedThemeId) {
          const savedTheme = predefinedThemes.find(t => t.id === savedThemeId);
          if (savedTheme) {
            setCurrentTheme(savedTheme);
            applyThemeToDOM(savedTheme);
          }
        } else {
          // Apply default theme
          applyThemeToDOM(predefinedThemes[0]);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
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

  const setTheme = (themeId: string) => {
    const newTheme = themes.find(t => t.id === themeId);
    if (newTheme) {
      setCurrentTheme(newTheme);
      applyThemeToDOM(newTheme);
      localStorage.setItem(THEME_STORAGE_KEY, themeId);
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