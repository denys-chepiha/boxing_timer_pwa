// Core
import React, { createContext, useContext, useEffect, useMemo } from 'react';

// Hooks
import { useThemeMode } from '@/hooks/useThemeMode';

// Theme
import { AppTheme, darkTheme, lightTheme } from '@/theme/theme';

// Types
import { ThemeMode } from '@/types/models';

type ThemeContextValue = {
  theme: AppTheme;
  mode: ThemeMode;
  setMode: (next: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

type Props = {
  children: React.ReactNode;
};

export const ThemeProvider = ({ children }: Props) => {
  const { mode, resolvedMode, setMode } = useThemeMode();

  const theme = useMemo<AppTheme>(
    () => (resolvedMode === 'dark' ? darkTheme : lightTheme),
    [resolvedMode],
  );

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.dataset.theme = resolvedMode;
    document.documentElement.style.colorScheme = resolvedMode;
    document.body.style.backgroundColor = theme.colors.background;
    document.body.style.color = theme.colors.text;

    const cssColors: Record<string, string> = {
      '--color-bg': theme.colors.background,
      '--color-bg-elevated': theme.colors.backgroundElevated,
      '--color-card': theme.colors.card,
      '--color-card-strong': theme.colors.cardStrong,
      '--color-text': theme.colors.text,
      '--color-text-muted': theme.colors.textMuted,
      '--color-text-subtle': theme.colors.textSubtle,
      '--color-primary': theme.colors.primary,
      '--color-primary-soft': theme.colors.primarySoft,
      '--color-primary-text': theme.colors.primaryText,
      '--color-border': theme.colors.border,
      '--color-border-strong': theme.colors.borderStrong,
      '--color-danger': theme.colors.danger,
      '--color-danger-soft': theme.colors.dangerSoft,
      '--color-success': theme.colors.success,
      '--color-success-soft': theme.colors.successSoft,
      '--color-warning': theme.colors.warning,
      '--color-warning-soft': theme.colors.warningSoft,
      '--color-surface': theme.colors.surface,
      '--color-surface-strong': theme.colors.surfaceStrong,
      '--color-surface-muted': theme.colors.surfaceMuted,
      '--color-input': theme.colors.input,
      '--color-overlay': theme.colors.overlay,
      '--shadow-elevated': theme.colors.shadow,
    };

    Object.entries(cssColors).forEach(([name, value]) => {
      document.documentElement.style.setProperty(name, value);
    });

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme.colors.background);
    }
  }, [resolvedMode, theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, mode, setMode }),
    [theme, mode, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
};
