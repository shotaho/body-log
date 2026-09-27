import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DateTimeField } from '@/components/date-time-field';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { getProfile, saveProfile, type Profile } from '@/db/profile';
import { getRegisteredScale, unregisterScale, type ScaleDevice } from '@/db/scale-devices';
import { fromLocalDateString, toLocalDateString } from '@/lib/date';
import { format1, parse1 } from '@/lib/decimal';
import type { Sex } from '@/lib/scale/body-composition';
import { useThemePreference, type ThemePreference } from '@/theme/theme-preference';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'システム' },
  { value: 'light', label: 'ライト' },
  { value: 'dark', label: 'ダーク' },
];

const SEX_OPTIONS: { value: Sex | 'unset'; label: string }[] = [
  { value: 'unset', label: '未設定' },
  { value: 'male', label: '男性' },
  { value: 'female', label: '女性' },
];

const HEIGHT_RANGE = { min: 100, max: 250 };
const DEFAULT_BIRTH_DATE = '1990-01-01';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { preference, setPreference } = useThemePreference();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [height, setHeight] = useState('');
  const [heightError, setHeightError] = useState<string>();
  const [scale, setScale] = useState<ScaleDevice | null>(null);

  useFocusEffect(
    useCallback(() => {
      getProfile(db).then((p) => {
        setProfile(p);
        setHeight(p.heightCm != null ? format1(p.heightCm) : '');
      });
      getRegisteredScale(db).then(setScale);
    }, [db])
  );

  const updateProfile = (next: Profile) => {
    setProfile(next);
    saveProfile(db, next);
  };

  /** 身長は入力を終えたときに検証して保存する */
  const commitHeight = () => {
    if (!profile) {
      return;
    }
    if (height.trim() === '') {
      setHeightError(undefined);
      updateProfile({ ...profile, heightCm: null });
      return;
    }
    const value = parse1(height);
    if (value == null || value < HEIGHT_RANGE.min || value > HEIGHT_RANGE.max) {
      setHeightError(`${HEIGHT_RANGE.min}〜${HEIGHT_RANGE.max} cm の範囲で入力してください`);
      return;
    }
    setHeightError(undefined);
    setHeight(format1(value));
    updateProfile({ ...profile, heightCm: value });
  };

  const confirmUnregister = () =>
    Alert.alert('体重計の登録を解除しますか?', '記録済みのデータは残ります。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '解除',
        style: 'destructive',
        onPress: async () => {
          await unregisterScale(db);
          setScale(null);
        },
      },
    ]);

  return (
    <Screen>
      <Card title="テーマ">
        <SegmentedControl options={THEME_OPTIONS} value={preference} onChange={setPreference} />
      </Card>

      {profile && (
        <Card title="プロフィール(体組成の計算に使用)">
          <TextField
            label="身長"
            unit="cm"
            value={height}
            onChangeText={setHeight}
            onEndEditing={commitHeight}
            keyboardType="decimal-pad"
            placeholder="170.0"
            error={heightError}
          />
          <ThemedText type="smallBold" themeColor="textSecondary">
            生年月日
          </ThemedText>
          <DateTimeField
            mode="date"
            value={fromLocalDateString(profile.birthDate ?? DEFAULT_BIRTH_DATE)}
            onChange={(date) => updateProfile({ ...profile, birthDate: toLocalDateString(date) })}
          />
          {!profile.birthDate && (
            <ThemedText type="small" themeColor="textSecondary">
              未設定です。タップして選択してください。
            </ThemedText>
          )}
          <ThemedText type="smallBold" themeColor="textSecondary">
            性別
          </ThemedText>
          <SegmentedControl
            options={SEX_OPTIONS}
            value={profile.sex ?? 'unset'}
            onChange={(v) => updateProfile({ ...profile, sex: v === 'unset' ? null : v })}
          />
        </Card>
      )}

      <Card title="体重計">
        {scale ? (
          <>
            <ThemedText>Mi Body Composition Scale 2</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {scale.macAddress}
            </ThemedText>
            <Button title="登録を解除" variant="danger" onPress={confirmUnregister} />
          </>
        ) : (
          <ThemedText themeColor="textSecondary">
            未登録です。体重タブの計測画面で体重計に乗ると登録できます。
          </ThemedText>
        )}
      </Card>

      <Card title="アプリ情報">
        <ThemedText type="small" themeColor="textSecondary">
          バージョン {Constants.expoConfig?.version ?? '-'}
        </ThemedText>
      </Card>
    </Screen>
  );
}
