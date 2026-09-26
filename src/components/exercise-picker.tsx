import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chips } from '@/components/chips';
import { ExerciseSectionList } from '@/components/exercise-section-list';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { BODY_PARTS, type BodyPart } from '@/db/migrations';
import {
  DuplicateExerciseError,
  insertExercise,
  listExercises,
  type Exercise,
} from '@/db/workouts';
import { useTheme } from '@/hooks/use-theme';

const BODY_PART_OPTIONS = (Object.keys(BODY_PARTS) as BodyPart[]).map((value) => ({
  value,
  label: BODY_PARTS[value],
}));

/**
 * 種目を選ぶ全画面モーダル。検索と新しい種目の追加もここで行う。
 * 開くたびにマウントし直す(閉じたら親がアンマウントする)前提で、入力状態は持ち越さない。
 */
export function ExercisePicker({
  excludeIds,
  onSelect,
  onClose,
}: {
  /** すでにワークアウトにある種目(一覧から除く) */
  excludeIds: number[];
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [query, setQuery] = useState('');
  const [bodyPart, setBodyPart] = useState<BodyPart>('chest');
  const [error, setError] = useState<string>();

  useEffect(() => {
    listExercises(db).then(setExercises);
  }, [db]);

  const trimmed = query.trim();
  const filtered = exercises.filter(
    (e) => !excludeIds.includes(e.id) && (trimmed === '' || e.name.includes(trimmed))
  );
  const exactMatch = exercises.some((e) => e.name === trimmed);

  const addExercise = async () => {
    try {
      const id = await insertExercise(db, trimmed, bodyPart);
      onSelect({ id, name: trimmed, bodyPart, isPreset: false });
    } catch (e) {
      if (e instanceof DuplicateExerciseError) {
        setError('同じ名前の種目があります');
      } else {
        throw e;
      }
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderColor: theme.border }]}>
          <ThemedText type="smallBold" style={styles.title}>
            種目を選択
          </ThemedText>
          <Pressable accessibilityRole="button" hitSlop={12} onPress={onClose}>
            <ThemedText style={{ color: theme.primary }}>閉じる</ThemedText>
          </Pressable>
        </View>
        <ExerciseSectionList
          exercises={filtered}
          onPress={onSelect}
          bottomInset={0}
          header={
            <View style={styles.listHeader}>
              <TextField
                label="種目名で検索・追加"
                value={query}
                onChangeText={(text) => {
                  setQuery(text);
                  setError(undefined);
                }}
                placeholder="例: ベンチプレス"
                error={error}
              />
              {trimmed !== '' && !exactMatch && (
                <Card title={`「${trimmed}」を新しい種目として追加`}>
                  <Chips options={BODY_PART_OPTIONS} value={bodyPart} onChange={setBodyPart} />
                  <Button title="追加して選択" onPress={addExercise} />
                </Card>
              )}
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    flex: 1,
    fontSize: 18,
  },
  listHeader: {
    gap: Spacing.three,
  },
});
