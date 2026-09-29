import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { format1 } from '@/lib/decimal';

export type CompositionValues = {
  bodyFatPct: number | null;
  muscleKg: number | null;
  waterPct: number | null;
  boneKg: number | null;
  visceralFat: number | null;
  bmrKcal: number | null;
  bmi: number | null;
  impedance: number | null;
};

const ROWS: { key: keyof CompositionValues; label: string; format: (v: number) => string }[] = [
  { key: 'bodyFatPct', label: '体脂肪率', format: (v) => `${format1(v)} %` },
  { key: 'muscleKg', label: '筋肉量', format: (v) => `${format1(v)} kg` },
  { key: 'waterPct', label: '体水分率', format: (v) => `${format1(v)} %` },
  { key: 'boneKg', label: '骨量', format: (v) => `${format1(v)} kg` },
  { key: 'visceralFat', label: '内臓脂肪レベル', format: format1 },
  { key: 'bmrKcal', label: '基礎代謝', format: (v) => `${Math.round(v)} kcal` },
  { key: 'bmi', label: 'BMI', format: format1 },
  { key: 'impedance', label: 'インピーダンス', format: (v) => `${Math.round(v)} Ω` },
];

/** 体組成の一覧表示。値のない項目は出さない。 */
export function CompositionList({ values }: { values: CompositionValues }) {
  const rows = ROWS.filter((r) => values[r.key] != null);
  if (rows.length === 0) {
    return null;
  }
  return (
    <View style={styles.list}>
      {rows.map((r) => (
        <View key={r.key} style={styles.row}>
          <ThemedText themeColor="textSecondary" style={styles.label}>
            {r.label}
          </ThemedText>
          <ThemedText style={styles.value}>{r.format(values[r.key]!)}</ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    flex: 1,
  },
  value: {
    fontVariant: ['tabular-nums'],
  },
});
