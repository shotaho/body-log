import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { formatDateJa, startOfWeek, toLocalDateString } from '@/lib/date';
import { format1 } from '@/lib/decimal';

type Summary = {
  latestWeightKg: number | null;
  latestMeasuredAt: number | null;
  workoutsThisWeek: number;
};

export default function HomeScreen() {
  const db = useSQLiteContext();
  const [summary, setSummary] = useState<Summary | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const latest = await db.getFirstAsync<{ weight_kg: number; measured_at: number }>(
          'SELECT weight_kg, measured_at FROM body_record ORDER BY measured_at DESC LIMIT 1'
        );
        const week = await db.getFirstAsync<{ n: number }>(
          'SELECT COUNT(DISTINCT date) AS n FROM workout WHERE date >= ?',
          toLocalDateString(startOfWeek(new Date()))
        );
        if (active) {
          setSummary({
            latestWeightKg: latest?.weight_kg ?? null,
            latestMeasuredAt: latest?.measured_at ?? null,
            workoutsThisWeek: week?.n ?? 0,
          });
        }
      })();
      return () => {
        active = false;
      };
    }, [db])
  );

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <Screen>
        <ThemedText type="subtitle">{formatDateJa(new Date())}</ThemedText>

        <Card title="最新の体重">
          {summary?.latestWeightKg != null ? (
            <>
              <ThemedText style={styles.value}>{format1(summary.latestWeightKg)} kg</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatDateJa(new Date(summary.latestMeasuredAt!))}
              </ThemedText>
            </>
          ) : (
            <ThemedText themeColor="textSecondary">まだ記録がありません</ThemedText>
          )}
        </Card>

        <Card title="今週のトレーニング">
          <ThemedText style={styles.value}>{summary?.workoutsThisWeek ?? 0} 日</ThemedText>
        </Card>
      </Screen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  value: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: 700,
  },
});
