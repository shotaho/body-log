import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { TrendChart } from '@/components/trend-chart';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { listBodyRecords, type BodyRecord } from '@/db/body-records';
import { useOnDataChanged } from '@/hooks/use-data-changed';
import { useTheme } from '@/hooks/use-theme';
import { formatDateJa, startOfDay } from '@/lib/date';
import { format1 } from '@/lib/decimal';
import {
  movingAverage,
  rangeStart,
  toDailySeries,
  type DailyPoint,
  type Measurement,
  type Range,
} from '@/lib/weight-stats';

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: 'week', label: '週' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
  { value: 'all', label: '全期間' },
];

type Series = { daily: DailyPoint[]; average: DailyPoint[] };

/** 移動平均は期間外のデータも使って計算し、その後で表示期間に絞る(期間の先頭でも正しい平均になる)。 */
function buildSeries(measurements: Measurement[], from: number): Series {
  const daily = toDailySeries(measurements);
  const average = movingAverage(daily);
  return {
    daily: daily.filter((p) => p.time >= from),
    average: average.filter((p) => p.time >= from),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

export default function WeightScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [records, setRecords] = useState<BodyRecord[] | null>(null);
  const [range, setRange] = useState<Range>('month');

  const load = useCallback(() => {
    let active = true;
    listBodyRecords(db).then((rows) => active && setRecords(rows));
    return () => {
      active = false;
    };
  }, [db]);
  useFocusEffect(load);
  // 表示中に体重が自動で記録されたら反映する
  useOnDataChanged('body_record', load);

  const charts = useMemo(() => {
    if (!records || records.length === 0) {
      return null;
    }
    const now = new Date();
    const oldest = new Date(records[records.length - 1].measuredAt);
    const from = rangeStart(range, now) ?? startOfDay(oldest).getTime();
    const weight = buildSeries(
      records.map((r) => ({ measuredAt: r.measuredAt, value: r.weightKg })),
      from
    );
    const bodyFat = buildSeries(
      records
        .filter((r) => r.bodyFatPct != null)
        .map((r) => ({ measuredAt: r.measuredAt, value: r.bodyFatPct! })),
      from
    );
    return { from, to: startOfDay(now).getTime(), weight, bodyFat };
  }, [records, range]);

  if (records === null) {
    return null;
  }

  const header = (
    <View style={styles.header}>
      {records.length === 0 ? (
        <Card>
          <ThemedText themeColor="textSecondary">まだ記録がありません</ThemedText>
          <Button title="体重計で測る" onPress={() => router.push('/weight/scale')} />
          <Button title="手入力で記録する" onPress={() => router.push('/weight/new')} />
        </Card>
      ) : (
        <>
          <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />
          <Card title="体重(kg)">
            {charts && charts.weight.daily.length > 0 ? (
              <TrendChart
                key={range}
                unit="kg"
                from={charts.from}
                to={charts.to}
                {...charts.weight}
              />
            ) : (
              <ThemedText themeColor="textSecondary">この期間の記録はありません</ThemedText>
            )}
          </Card>
          {charts && charts.bodyFat.daily.length > 0 && (
            <Card title="体脂肪率(%)">
              <TrendChart
                key={range}
                unit="%"
                from={charts.from}
                to={charts.to}
                {...charts.bodyFat}
              />
            </Card>
          )}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.listTitle}>
            記録一覧
          </ThemedText>
        </>
      )}
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      data={records}
      keyExtractor={(r) => String(r.id)}
      ListHeaderComponent={header}
      ItemSeparatorComponent={() => (
        <View style={[styles.separator, { backgroundColor: theme.border }]} />
      )}
      renderItem={({ item }) => <RecordRow record={item} />}
    />
  );
}

function RecordRow({ record }: { record: BodyRecord }) {
  const date = new Date(record.measuredAt);
  const details = [
    record.bodyFatPct != null ? `体脂肪 ${format1(record.bodyFatPct)}%` : null,
    record.source === 'scale' ? '体重計' : null,
    record.note,
  ].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/weight/[id]', params: { id: record.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowMain}>
        <ThemedText>
          {formatDateJa(date)} {pad(date.getHours())}:{pad(date.getMinutes())}
        </ThemedText>
        {details.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {details.join(' · ')}
          </ThemedText>
        )}
      </View>
      <ThemedText style={styles.weight}>{format1(record.weightKg)} kg</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  listTitle: {
    marginTop: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  rowMain: {
    flex: 1,
    gap: Spacing.half,
  },
  weight: {
    fontSize: 18,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
});
