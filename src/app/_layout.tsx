import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StyleSheet, useColorScheme, View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { AutoScaleRecorder } from '@/components/auto-scale-recorder';
import { RestTimerProvider } from '@/components/rest-timer-provider';
import { DATABASE_NAME } from '@/db';
import { migrateDbIfNeeded } from '@/db/migrations';
import { useAppUpdate } from '@/hooks/use-app-update';
import { ThemePreferenceProvider } from '@/theme/theme-preference';

export default function RootLayout() {
  useAppUpdate();
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
      <ThemePreferenceProvider>
        <RestTimerProvider>
          <ThemedNavigation />
        </RestTimerProvider>
      </ThemePreferenceProvider>
    </SQLiteProvider>
  );
}

function ThemedNavigation() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View style={styles.root}>
        <AppTabs />
        <AutoScaleRecorder />
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
