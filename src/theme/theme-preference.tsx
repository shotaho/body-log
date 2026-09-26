import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import { getSetting, setSetting } from '@/db/settings';

export type ThemePreference = 'system' | 'light' | 'dark';

const SETTING_KEY = 'theme';

const ThemePreferenceContext = createContext<{
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
} | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/**
 * テーマ設定(システム/ライト/ダーク)を DB に保存し、Appearance に反映する。
 * Appearance.setColorScheme で上書きすると useColorScheme() の値も変わるため、
 * 各画面は useColorScheme() / useTheme() を使うだけで追従する。
 */
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    getSetting(db, SETTING_KEY).then((value) => {
      if (isThemePreference(value)) {
        setPreferenceState(value);
      }
    });
  }, [db]);

  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      setSetting(db, SETTING_KEY, next);
    },
    [db]
  );

  return (
    <ThemePreferenceContext.Provider value={{ preference, setPreference }}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  const context = useContext(ThemePreferenceContext);
  if (!context) {
    throw new Error('useThemePreference must be used within ThemePreferenceProvider');
  }
  return context;
}
