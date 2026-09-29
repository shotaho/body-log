import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { monthGrid } from '@/lib/calendar';
import { toLocalDateString } from '@/lib/date';

/** 同じ日をこの時間内に2回タップしたらダブルタップとみなす */
export const DOUBLE_TAP_MS = 400;

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

type Props = {
  year: number;
  /** 0 始まり */
  month: number;
  workoutDates: Set<string>;
  weighDates: Set<string>;
  /** 'YYYY-MM-DD' */
  today: string;
  selected: string | null;
  onSelect: (date: string) => void;
  /** 同じ日を素早く2回タップしたとき */
  onDoubleSelect?: (date: string) => void;
  onChangeMonth: (delta: number) => void;
};

/** 月カレンダー。トレーニングした日と体重を測った日に印を付ける。 */
export function MonthCalendar({
  year,
  month,
  workoutDates,
  weighDates,
  today,
  selected,
  onSelect,
  onDoubleSelect,
  onChangeMonth,
}: Props) {
  const theme = useTheme();
  const lastTap = useRef<{ date: string; at: number } | null>(null);

  /** at: タップした時刻(ms。イベントのタイムスタンプ) */
  const press = (date: string, at: number) => {
    const last = lastTap.current;
    onSelect(date);
    if (onDoubleSelect && last?.date === date && at - last.at <= DOUBLE_TAP_MS) {
      lastTap.current = null;
      onDoubleSelect(date);
    } else {
      lastTap.current = { date, at };
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="前の月"
          hitSlop={12}
          onPress={() => onChangeMonth(-1)}>
          <MaterialIcons name="chevron-left" size={28} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold" style={styles.title}>
          {year}年{month + 1}月
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="次の月"
          hitSlop={12}
          onPress={() => onChangeMonth(1)}>
          <MaterialIcons name="chevron-right" size={28} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.week}>
        {WEEKDAYS.map((w) => (
          <ThemedText key={w} type="small" themeColor="textSecondary" style={styles.weekday}>
            {w}
          </ThemedText>
        ))}
      </View>

      {monthGrid(year, month).map((week, i) => (
        <View key={i} style={styles.week}>
          {week.map((day, j) => {
            if (!day) {
              return <View key={j} style={styles.cell} />;
            }
            const date = toLocalDateString(day);
            const trained = workoutDates.has(date);
            const weighed = weighDates.has(date);
            const labels = [trained && 'トレーニング', weighed && '体重記録'].filter(Boolean);
            return (
              <Pressable
                key={j}
                accessibilityRole="button"
                accessibilityLabel={`${month + 1}月${day.getDate()}日${labels.length ? ` ${labels.join('・')}あり` : ''}`}
                accessibilityState={{ selected: selected === date }}
                onPress={(e) => press(date, e.nativeEvent.timestamp)}
                style={[
                  styles.cell,
                  styles.day,
                  selected === date && { backgroundColor: theme.backgroundSelected },
                  today === date && { borderColor: theme.primary, borderWidth: 1 },
                ]}>
                <ThemedText type="small" style={styles.dayNumber}>
                  {day.getDate()}
                </ThemedText>
                <View style={styles.markers}>
                  {trained && (
                    <View style={[styles.marker, { backgroundColor: theme.chartSeries }]} />
                  )}
                  {weighed && (
                    <View style={[styles.marker, { backgroundColor: theme.chartMuted }]} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.legend}>
        <LegendItem color={theme.chartSeries} label="トレーニング" />
        <LegendItem color={theme.chartMuted} label="体重記録" />
      </View>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.marker, { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
  },
  week: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
  },
  day: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    borderColor: 'transparent',
    borderWidth: 1,
  },
  dayNumber: {
    fontVariant: ['tabular-nums'],
  },
  markers: {
    flexDirection: 'row',
    gap: 3,
    height: 8,
    alignItems: 'center',
  },
  marker: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
