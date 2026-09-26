import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { TrendChart } from '@/components/trend-chart';
import { Spacing } from '@/constants/theme';
import { getExercise, getExerciseHistory, type Exercise, type HistorySet } from '@/db/workouts';
import { formatDateJa, fromLocalDateString, startOfDay } from '@/lib/date';
import { format1 } from '@/lib/decimal';
import { estimate1rm, formatSet, sessionSeries, type SessionMetric } from '@/lib/workout-stats';

const METRIC_OPTIONS: { value: SessionMetric; label: string }[] = [
  { value: 'maxWeight', label: '最大重量' },
  { value: 'e1rm', label: '推定1RM' },
  { value: 'volume', label: 'ボリューム' },
];

const formatInteger = (v: number) => Math.round(v).toLocaleString('ja-JP');

export default function ExerciseDetailScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseId = Number(id);
  const [exercise, setExercise] = useState<Exercise | null>();
  const [history, setHistory] = useState<HistorySet[]>([]);
  const [metric, setMetric] = useState<SessionMetric>('maxWeight');

  useEffect(() => {
    getExercise(db, exerciseId).then(setExercise);
    getExerciseHistory(db, exerciseId).then(setHistory);
  }, [db, exerciseId]);

  const series = useMemo(() => sessionSeries(history), [history]);

  /** 自己ベスト: 最大重量のセットと最大推定1RMのセット(同値なら先に達成した方) */
  const records = useMemo(() => {
    const byWeight = history.reduce<HistorySet | null>(
      (best, s) => (!best || s.weightKg > best.weightKg ? s : best),
      null
    );
    const byE1rm = history.reduce<HistorySet | null>(
      (best, s) => (!best || estimate1rm(s) > estimate1rm(best) ? s : best),
      null
    );
    return { byWeight, byE1rm };
  }, [history]);

  /** 日付の新しい順にまとめた履歴 */
  const sessions = useMemo(() => {
    const byDate = new Map<string, HistorySet[]>();
    for (const s of history) {
      byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
    }
    return [...byDate.entries()].reverse();
  }, [history]);

  if (exercise === undefined) {
    return null;
  }

  const points = series[metric];
  const isVolume = metric === 'volume';

  return (
    <Screen>
      <Stack.Screen options={{ title: exercise?.name ?? '種目' }} />

      {history.length === 0 ? (
        <Card>
          <ThemedText themeColor="textSecondary">まだこの種目の記録がありません</ThemedText>
        </Card>
      ) : (
        <>
          <View style={styles.records}>
            {records.byWeight && (
              <Card title="最大重量" style={styles.flex}>
                <ThemedText style={styles.recordValue}>
                  {format1(records.byWeight.weightKg)} kg
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatSet(records.byWeight, format1)} ·{' '}
                  {formatDateJa(fromLocalDateString(records.byWeight.date))}
                </ThemedText>
              </Card>
            )}
            {records.byE1rm && estimate1rm(records.byE1rm) > 0 && (
              <Card title="推定1RM" style={styles.flex}>
                <ThemedText style={styles.recordValue}>
                  {format1(estimate1rm(records.byE1rm))} kg
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatSet(records.byE1rm, format1)} ·{' '}
                  {formatDateJa(fromLocalDateString(records.byE1rm.date))}
                </ThemedText>
              </Card>
            )}
          </View>

          <SegmentedControl options={METRIC_OPTIONS} value={metric} onChange={setMetric} />
          <Card title={`${METRIC_OPTIONS.find((o) => o.value === metric)!.label}の推移(kg)`}>
            <TrendChart
              key={metric}
              daily={points}
              unit="kg"
              formatValue={isVolume ? formatInteger : format1}
              from={points[0].time}
              to={Math.max(points[points.length - 1].time, startOfDay(new Date()).getTime())}
            />
          </Card>

          <ThemedText type="smallBold" themeColor="textSecondary">
            履歴
          </ThemedText>
          {sessions.map(([date, sets]) => (
            <Card key={date} title={formatDateJa(fromLocalDateString(date))}>
              <ThemedText>{sets.map((s) => formatSet(s, format1)).join(', ')}</ThemedText>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  records: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  recordValue: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: 700,
  },
});
