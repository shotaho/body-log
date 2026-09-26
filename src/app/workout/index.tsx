import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { findOrCreateWorkout, listWorkouts, type WorkoutSummary } from '@/db/workouts';
import { useTheme } from '@/hooks/use-theme';
import { formatDateJa, fromLocalDateString, toLocalDateString } from '@/lib/date';

const formatVolume = (kg: number) => `${Math.round(kg).toLocaleString('ja-JP')} kg`;

export default function WorkoutListScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [workouts, setWorkouts] = useState<WorkoutSummary[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listWorkouts(db).then((rows) => active && setWorkouts(rows));
      return () => {
        active = false;
      };
    }, [db])
  );

  /** 今日のワークアウトを開く(なければ作成)。 */
  const openTodayWorkout = async () => {
    const id = await findOrCreateWorkout(db, toLocalDateString(new Date()));
    router.push({ pathname: '/workout/[id]', params: { id } });
  };

  if (workouts === null) {
    return null;
  }

  const header = (
    <View style={styles.header}>
      <Button title="今日のトレーニングを記録" onPress={openTodayWorkout} />
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/workout/exercises')}
        style={({ pressed }) => pressed && styles.pressed}>
        <Card>
          <View style={styles.linkRow}>
            <ThemedText style={styles.flex}>種目別の記録・グラフ</ThemedText>
            <ThemedText themeColor="textSecondary">›</ThemedText>
          </View>
        </Card>
      </Pressable>
      {workouts.length === 0 ? (
        <ThemedText themeColor="textSecondary">まだ記録がありません</ThemedText>
      ) : (
        <ThemedText type="smallBold" themeColor="textSecondary">
          履歴
        </ThemedText>
      )}
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      data={workouts}
      keyExtractor={(w) => String(w.id)}
      ListHeaderComponent={header}
      ItemSeparatorComponent={() => (
        <View style={[styles.separator, { backgroundColor: theme.border }]} />
      )}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/workout/[id]', params: { id: item.id } })}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <View style={styles.rowTop}>
            <ThemedText style={styles.flex}>
              {formatDateJa(fromLocalDateString(item.date))}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.setCount}セット · {formatVolume(item.volumeKg)}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {item.exerciseNames.length > 0 ? item.exerciseNames.join('・') : '(セットなし)'}
            {item.note ? `  — ${item.note}` : ''}
          </ThemedText>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    paddingVertical: Spacing.three,
    gap: Spacing.half,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
});
