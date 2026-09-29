import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BodyMap } from '@/components/body-map';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { BODY_PARTS } from '@/db/migrations';
import {
  getWorkout,
  listExercises,
  listSets,
  type Exercise,
  type Workout,
  type WorkoutSet,
} from '@/db/workouts';
import { BODY_PART_KEYS, shadeLevel, volumeByBodyPart } from '@/lib/body-map';
import { formatDateJa, fromLocalDateString } from '@/lib/date';
import { formatDuration } from '@/lib/rest-timer';
import { totalVolume } from '@/lib/workout-stats';

const formatKg = (kg: number) => `${Math.round(kg).toLocaleString('ja-JP')} kg`;

/** 「トレーニング終了」後の結果画面。その日鍛えた部位を全身イラストで表示する。 */
export default function WorkoutSummaryScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = Number(id);
  const [data, setData] = useState<{
    workout: Workout | null;
    sets: WorkoutSet[];
    exercises: Map<number, Exercise>;
  } | null>(null);

  useEffect(() => {
    Promise.all([getWorkout(db, workoutId), listSets(db, workoutId), listExercises(db)]).then(
      ([workout, sets, all]) =>
        setData({ workout, sets, exercises: new Map(all.map((e) => [e.id, e])) })
    );
  }, [db, workoutId]);

  const summary = useMemo(() => {
    if (!data) {
      return null;
    }
    const { sets, exercises } = data;
    const withPart = sets.map((s) => ({
      ...s,
      bodyPart: exercises.get(s.exerciseId)?.bodyPart ?? 'other',
    }));
    const volumes = volumeByBodyPart(withPart);
    const max = Math.max(...BODY_PART_KEYS.map((p) => volumes[p]));
    const levels = Object.fromEntries(
      BODY_PART_KEYS.map((p) => [p, shadeLevel(volumes[p], max)])
    ) as Record<keyof typeof BODY_PARTS, number>;
    // 所要時間: 最初のセットの開始(不明なら完了)から終了ボタンまで
    const firstAt = Math.min(...sets.map((s) => s.startedAt ?? s.completedAt ?? Infinity));
    const endAt = data.workout?.finishedAt ?? Math.max(...sets.map((s) => s.completedAt ?? 0));
    const durationSeconds =
      Number.isFinite(firstAt) && endAt > firstAt ? (endAt - firstAt) / 1000 : null;
    return {
      volumes,
      levels,
      exerciseCount: new Set(sets.map((s) => s.exerciseId)).size,
      setCount: sets.length,
      totalKg: totalVolume(sets),
      durationSeconds,
    };
  }, [data]);

  if (!data || !summary) {
    return null;
  }
  if (!data.workout) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">ワークアウトが見つかりません</ThemedText>
      </Screen>
    );
  }

  const parts = BODY_PART_KEYS.filter((p) => summary.volumes[p] > 0).sort(
    (a, b) => summary.volumes[b] - summary.volumes[a]
  );

  return (
    <Screen>
      <ThemedText type="subtitle">お疲れさまでした</ThemedText>
      <ThemedText themeColor="textSecondary">
        {formatDateJa(fromLocalDateString(data.workout.date))}
      </ThemedText>

      <View style={styles.stats}>
        <Stat label="種目" value={`${summary.exerciseCount}`} />
        <Stat label="セット" value={`${summary.setCount}`} />
        <Stat label="ボリューム" value={formatKg(summary.totalKg)} />
        {summary.durationSeconds != null && (
          <Stat label="時間" value={formatDuration(summary.durationSeconds)} />
        )}
      </View>

      <Card title="鍛えた部位">
        <BodyMap levels={summary.levels} />
      </Card>

      <Card title="部位ごとのボリューム">
        {parts.map((p) => (
          <View key={p} style={styles.partRow}>
            <ThemedText style={styles.flex}>{BODY_PARTS[p]}</ThemedText>
            <ThemedText style={styles.number}>{formatKg(summary.volumes[p])}</ThemedText>
          </View>
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          ボリューム = 重量 × 回数の合計(自重の種目は 1 回 = 1kg として計算)
        </ThemedText>
      </Card>

      <Button title="記録に戻る" onPress={() => router.back()} />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.flex}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 700,
  },
  partRow: {
    flexDirection: 'row',
  },
  number: {
    fontVariant: ['tabular-nums'],
  },
});
