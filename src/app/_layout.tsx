import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { DATABASE_NAME } from '@/db';
import { migrateDbIfNeeded } from '@/db/migrations';
import { useAppUpdate } from '@/hooks/use-app-update';
import { ThemePreferenceProvider } from '@/theme/theme-preference';

export default function RootLayout() {
  useAppUpdate();
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
      <ThemePreferenceProvider>
        <ThemedNavigation />
      </ThemePreferenceProvider>
    </SQLiteProvider>
  );
}

function ThemedNavigation() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppTabs />
    </ThemeProvider>
  );
}
