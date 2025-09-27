import { Theme } from '../types/theme';

export const brandTheme: Theme = {
  id: 'brand',
  name: 'Brand Theme',
  colors: {
    primary: {
      50: '#FFF8F0',
      100: '#FFE5CC',
      200: '#FFD6A5',
      300: '#FFC078',
      400: '#FFA94B',
      500: '#FF6B35',
      600: '#E85D2A',
      700: '#D1501F',
      800: '#BA4214',
      900: '#A33509',
    },
    secondary: {
      50: '#FFF8F0',
      100: '#FFE5CC',
      200: '#FFD6A5',
      300: '#FFC078',
      400: '#FFA94B',
      500: '#FF9A1F',
      600: '#E8870B',
      700: '#D17500',
      800: '#BA6300',
      900: '#A35100',
    },
    background: {
      primary: '#FFF8F0',
      secondary: '#FFFFFF',
      tertiary: '#F9F9F9',
    },
    text: {
      primary: '#2E2E2E',
      secondary: '#5C5C5C',
      muted: '#8B8B8B',
      inverse: '#FFFFFF',
    },
    border: {
      light: '#E5E5E5',
      medium: '#D1D5DB',
      dark: '#9CA3AF',
    },
    status: {
      success: {
        bg: '#F0F9FF',
        text: '#065F46',
        border: '#10B981',
      },
      warning: {
        bg: '#FFFBEB',
        text: '#92400E',
        border: '#F59E0B',
      },
      error: {
        bg: '#FEF2F2',
        text: '#B91C1C',
        border: '#EF4444',
      },
      info: {
        bg: '#EFF6FF',
        text: '#1E40AF',
        border: '#3B82F6',
      },
    },
  },
  typography: {
    fontFamily: {
      sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    borderRadius: {
      none: '0',
      sm: '0.125rem',
      md: '0.375rem',
      lg: '0.5rem',
      xl: '0.75rem',
      full: '9999px',
    },
    spacing: {
      xs: '0.5rem',
      sm: '0.75rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
      '2xl': '3rem',
      '3xl': '4rem',
    },
    shadows: {
      sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    },
  },
};

export const lightTheme: Theme = {
  id: 'light',
  name: 'Light Theme',
  colors: {
    primary: {
      50: '#EFF6FF',
      100: '#DBEAFE',
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#3B82F6',
      600: '#2563EB',
      700: '#1D4ED8',
      800: '#1E40AF',
      900: '#1E3A8A',
    },
    secondary: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
    },
    background: {
      primary: '#FFFFFF',
      secondary: '#F8FAFC',
      tertiary: '#F1F5F9',
    },
    text: {
      primary: '#1F2937',
      secondary: '#4B5563',
      muted: '#6B7280',
      inverse: '#FFFFFF',
    },
    border: {
      light: '#E5E7EB',
      medium: '#D1D5DB',
      dark: '#9CA3AF',
    },
    status: {
      success: {
        bg: '#F0FDF4',
        text: '#166534',
        border: '#22C55E',
      },
      warning: {
        bg: '#FFFBEB',
        text: '#92400E',
        border: '#F59E0B',
      },
      error: {
        bg: '#FEF2F2',
        text: '#DC2626',
        border: '#EF4444',
      },
      info: {
        bg: '#EFF6FF',
        text: '#1D4ED8',
        border: '#3B82F6',
      },
    },
  },
  typography: {
    fontFamily: {
      sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    borderRadius: {
      none: '0',
      sm: '0.125rem',
      md: '0.375rem',
      lg: '0.5rem',
      xl: '0.75rem',
      full: '9999px',
    },
    spacing: {
      xs: '0.5rem',
      sm: '0.75rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
      '2xl': '3rem',
      '3xl': '4rem',
    },
    shadows: {
      sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    },
  },
};

export const darkTheme: Theme = {
  id: 'dark',
  name: 'Dark Theme',
  colors: {
    primary: {
      50: '#EFF6FF',
      100: '#DBEAFE',
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#3B82F6',
      600: '#2563EB',
      700: '#1D4ED8',
      800: '#1E40AF',
      900: '#1E3A8A',
    },
    secondary: {
      50: '#1F2937',  // Dark background for secondary buttons
      100: '#374151', // Slightly lighter for secondary button backgrounds
      200: '#4B5563', // Medium gray for borders
      300: '#6B7280', // Lighter gray for text
      400: '#9CA3AF', // Even lighter for muted elements
      500: '#D1D5DB', // Light gray for readable text
      600: '#E5E7EB', // Very light for contrast
      700: '#F3F4F6', // Almost white
      800: '#F9FAFB', // Very light
      900: '#FFFFFF', // Pure white
    },
    background: {
      primary: '#0F172A',   // Darker main background
      secondary: '#1E293B', // Slightly lighter for cards
      tertiary: '#334155',  // Even lighter for interactive elements
    },
    text: {
      primary: '#F8FAFC',   // Very light text for primary content
      secondary: '#E2E8F0', // Light gray for secondary content
      muted: '#94A3B8',     // Muted but still readable
      inverse: '#0F172A',   // Dark text for light backgrounds
    },
    border: {
      light: '#374151',  // Subtle borders
      medium: '#4B5563', // Medium contrast borders
      dark: '#6B7280',   // Higher contrast borders
    },
    status: {
      success: {
        bg: '#065F46',     // Darker green background
        text: '#D1FAE5',   // Light green text
        border: '#10B981', // Green border
      },
      warning: {
        bg: '#92400E',     // Darker orange background
        text: '#FEF3C7',   // Light yellow text
        border: '#F59E0B', // Orange border
      },
      error: {
        bg: '#991B1B',     // Darker red background
        text: '#FEE2E2',   // Light red text
        border: '#EF4444', // Red border
      },
      info: {
        bg: '#1E40AF',     // Darker blue background
        text: '#DBEAFE',   // Light blue text
        border: '#3B82F6', // Blue border
      },
    },
  },
  typography: {
    fontFamily: {
      sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    borderRadius: {
      none: '0',
      sm: '0.125rem',
      md: '0.375rem',
      lg: '0.5rem',
      xl: '0.75rem',
      full: '9999px',
    },
    spacing: {
      xs: '0.5rem',
      sm: '0.75rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
      '2xl': '3rem',
      '3xl': '4rem',
    },
    shadows: {
      sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    },
  },
};

export const predefinedThemes: Theme[] = [
  brandTheme,
  lightTheme,
  darkTheme,
];