import Constants from 'expo-constants';

import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { useThemePreference, type ThemePreference } from '@/theme/theme-preference';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'システム' },
  { value: 'light', label: 'ライト' },
  { value: 'dark', label: 'ダーク' },
];

export default function SettingsScreen() {
  const { preference, setPreference } = useThemePreference();

  return (
    <Screen>
      <Card title="テーマ">
        <SegmentedControl options={THEME_OPTIONS} value={preference} onChange={setPreference} />
      </Card>

      <Card title="アプリ情報">
        <ThemedText type="small" themeColor="textSecondary">
          バージョン {Constants.expoConfig?.version ?? '-'}
        </ThemedText>
      </Card>
    </Screen>
  );
}
