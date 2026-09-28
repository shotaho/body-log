import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { MonthCalendar } from '@/components/month-calendar';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { getActivityDates, getDayWorkouts, type DayWorkout } from '@/db/activity';
import { listBodyRecordsBetween, type BodyRecord } from '@/db/body-records';
import { useOpenWorkout } from '@/hooks/use-open-workout';
import { addMonths } from '@/lib/calendar';
import { formatDateJa, fromLocalDateString, startOfWeek, toLocalDateString } from '@/lib/date';
import { format1 } from '@/lib/decimal';

type Summary = {
  latest: { weightKg: number; measuredAt: number } | null;
  /** 最新とその1つ前の記録の差 */
  deltaKg: number | null;
  trainingDaysThisWeek: number;
};

type Activity = { workoutDates: Set<string>; weighDates: Set<string> };

const pad = (n: number) => String(n).padStart(2, '0');

function formatDelta(kg: number): string {
  const rounded = Math.round(kg * 10) / 10;
  if (rounded === 0) {
    return '±0.0 kg';
  }
  return `${rounded > 0 ? '+' : '−'}${format1(Math.abs(rounded))} kg`;
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const today = toLocalDateString(new Date());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [month, setMonth] = useState(() => ({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  }));
  const [activity, setActivity] = useState<Activity>({
    workoutDates: new Set(),
    weighDates: new Set(),
  });
  const [selected, setSelected] = useState<string>(today);
  const [day, setDay] = useState<{ records: BodyRecord[]; workouts: DayWorkout[] } | null>(null);
  const openWorkout = useOpenWorkout();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [latest, previous] = await db.getAllAsync<{ weight_kg: number; measured_at: number }>(
          'SELECT weight_kg, measured_at FROM body_record ORDER BY measured_at DESC, id DESC LIMIT 2'
        );
        const week = await db.getFirstAsync<{ n: number }>(
          `SELECT COUNT(DISTINCT date) AS n FROM workout w WHERE date >= ?
           AND EXISTS (SELECT 1 FROM workout_set s WHERE s.workout_id = w.id)`,
          toLocalDateString(startOfWeek(new Date()))
        );
        if (active) {
          setSummary({
            latest: latest ? { weightKg: latest.weight_kg, measuredAt: latest.measured_at } : null,
            deltaKg: latest && previous ? latest.weight_kg - previous.weight_kg : null,
            trainingDaysThisWeek: week?.n ?? 0,
          });
        }
      })();
      return () => {
        active = false;
      };
    }, [db])
  );

  // 表示中の月の印
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const from = new Date(month.year, month.month, 1);
      const to = new Date(month.year, month.month + 1, 1);
      getActivityDates(db, from, to).then((a) => active && setActivity(a));
      return () => {
        active = false;
      };
    }, [db, month])
  );

  // 選択した日の内容
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const from = fromLocalDateString(selected);
      const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
      Promise.all([listBodyRecordsBetween(db, from, to), getDayWorkouts(db, selected)]).then(
        ([records, workouts]) => active && setDay({ records, workouts })
      );
      return () => {
        active = false;
      };
    }, [db, selected])
  );

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <Screen>
        <ThemedText type="subtitle">{formatDateJa(new Date())}</ThemedText>

        <View style={styles.row}>
          <Card title="最新の体重" style={styles.flex}>
            {summary?.latest ? (
              <>
                <ThemedText style={styles.value}>{format1(summary.latest.weightKg)} kg</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDateJa(new Date(summary.latest.measuredAt))}
                  {summary.deltaKg != null && ` · 前回比 ${formatDelta(summary.deltaKg)}`}
                </ThemedText>
              </>
            ) : (
              <ThemedText themeColor="textSecondary">まだ記録がありません</ThemedText>
            )}
          </Card>
          <Card title="今週のトレーニング" style={styles.flex}>
            <ThemedText style={styles.value}>{summary?.trainingDaysThisWeek ?? 0} 日</ThemedText>
          </Card>
        </View>

        <Card>
          <MonthCalendar
            year={month.year}
            month={month.month}
            workoutDates={activity.workoutDates}
            weighDates={activity.weighDates}
            today={today}
            selected={selected}
            onSelect={setSelected}
            onChangeMonth={(delta) => setMonth((m) => addMonths(m.year, m.month, delta))}
          />
        </Card>

        <Card title={formatDateJa(fromLocalDateString(selected))}>
          {day && day.records.length === 0 && day.workouts.length === 0 && (
            <ThemedText themeColor="textSecondary">記録はありません</ThemedText>
          )}
          {day?.records.map((r) => {
            const t = new Date(r.measuredAt);
            return (
              <Pressable
                key={`r${r.id}`}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/weight/[id]', params: { id: r.id } })}
                style={({ pressed }) => [styles.dayRow, pressed && styles.pressed]}>
                <ThemedText themeColor="textSecondary" style={styles.time}>
                  {pad(t.getHours())}:{pad(t.getMinutes())}
                </ThemedText>
                <ThemedText style={styles.flex}>
                  体重 {format1(r.weightKg)} kg
                  {r.bodyFatPct != null ? ` · 体脂肪 ${format1(r.bodyFatPct)}%` : ''}
                </ThemedText>
              </Pressable>
            );
          })}
          {day?.workouts.map((w) => (
            <Pressable
              key={`w${w.id}`}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}
              style={({ pressed }) => [styles.dayRow, pressed && styles.pressed]}>
              <ThemedText themeColor="textSecondary" style={styles.time}>
                筋トレ
              </ThemedText>
              <ThemedText style={styles.flex}>
                {w.exerciseNames.join('・')}({w.setCount}セット)
              </ThemedText>
            </Pressable>
          ))}
          {/* 未来の日付には記録しない。'YYYY-MM-DD' は文字列比較で日付順になる */}
          {selected <= today && (
            <Button
              title={
                day?.workouts.length ? 'この日のトレーニングを開く' : 'この日のトレーニングを記録'
              }
              variant="secondary"
              onPress={() => openWorkout(selected)}
            />
          )}
        </Card>
      </Screen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  value: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: 700,
  },
  dayRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  time: {
    width: 44,
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.6,
  },
});
