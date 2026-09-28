import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { NumericKeypad } from '@/components/numeric-keypad';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { WorkoutSet } from '@/db/workouts';
import { useTheme } from '@/hooks/use-theme';
import { fromLocalDateString } from '@/lib/date';
import { format1 } from '@/lib/decimal';
import { applyKey, stepWeight, type KeypadKey } from '@/lib/keypad';
import { formatDuration, type SetTiming } from '@/lib/rest-timer';
import { formatSet, parseSetForm, type SetValues } from '@/lib/workout-stats';

type Field = 'weight' | 'reps';

const FIELD_OPTIONS: Record<Field, { decimal: boolean; maxIntDigits: number }> = {
  weight: { decimal: true, maxIntDigits: 4 },
  reps: { decimal: false, maxIntDigits: 3 },
};

type Props = {
  name: string;
  /** このワークアウトでのこの種目のセット(順番どおり) */
  sets: WorkoutSet[];
  /** 前回この種目を行ったときの記録 */
  previous: { date: string; sets: WorkoutSet[] } | null;
  prSetIds: Set<number>;
  /** セットごとのセット時間・レスト時間 */
  timings?: Map<number, SetTiming>;
  onAdd: (sets: SetValues[], options: { copied: boolean }) => void;
  onUpdate: (id: number, values: SetValues) => void;
  onDelete: (id: number) => void;
  onOpenHistory: () => void;
};

const toInput = (s: SetValues | undefined) => ({
  weight: s && s.weightKg > 0 ? format1(s.weightKg) : '',
  reps: s ? String(s.reps) : '',
});

const shortDate = (date: string) => {
  const d = fromLocalDateString(date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

function timingText(timing: SetTiming | undefined): string | null {
  if (!timing) {
    return null;
  }
  const parts = [
    timing.restSeconds != null ? `レスト ${formatDuration(timing.restSeconds)}` : null,
    timing.setSeconds != null ? `セット ${formatDuration(timing.setSeconds)}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * ワークアウト内の1種目分。セット一覧と入力欄(追加・編集)を持つ。
 * 重量・回数はアプリ内テンキーで入力する(OS のキーボードは使わない)。
 */
export function ExerciseBlock({
  name,
  sets,
  previous,
  prSetIds,
  timings,
  onAdd,
  onUpdate,
  onDelete,
  onOpenHistory,
}: Props) {
  const theme = useTheme();
  // 入力欄の初期値: 直前のセット → 前回の1セット目 → 空
  const [input, setInput] = useState(() => toInput(sets.at(-1) ?? previous?.sets[0]));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [activeField, setActiveField] = useState<Field | null>(null);
  /** 欄を選んだ直後の最初のキーは、今の値を置き換える */
  const [replaceNext, setReplaceNext] = useState(false);

  const focus = (field: Field) => {
    setActiveField(field);
    setReplaceNext(true);
  };

  const pressKey = (key: KeypadKey) => {
    if (!activeField) {
      return;
    }
    setInput((v) => {
      const base = replaceNext && key !== 'back' ? '' : v[activeField];
      return { ...v, [activeField]: applyKey(base, key, FIELD_OPTIONS[activeField]) };
    });
    setReplaceNext(false);
  };

  const step = (delta: number) => {
    setInput((v) => ({ ...v, weight: stepWeight(v.weight, delta) }));
    setReplaceNext(false);
  };

  const submit = () => {
    const result = parseSetForm(input.weight, input.reps);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(undefined);
    const values = { weightKg: result.weightKg, reps: result.reps };
    if (editingId != null) {
      onUpdate(editingId, values);
      stopEditing();
    } else {
      // 次のセットも同じ値から入力できるよう、入力欄はそのまま残す
      onAdd([values], { copied: false });
      setReplaceNext(true);
    }
  };

  const startEditing = (s: WorkoutSet) => {
    setEditingId(s.id);
    setInput(toInput(s));
    setError(undefined);
    focus('weight');
  };

  const stopEditing = () => {
    setEditingId(null);
    setInput(toInput(sets.at(-1)));
    setError(undefined);
  };

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <Pressable accessibilityRole="button" onPress={onOpenHistory} style={styles.titleRow}>
        <ThemedText type="smallBold" style={styles.title}>
          {name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          履歴 ›
        </ThemedText>
      </Pressable>

      {previous && (
        <View style={styles.previousRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            前回 {shortDate(previous.date)}:{' '}
            {previous.sets.map((s) => formatSet(s, format1)).join(', ')}
          </ThemedText>
          {sets.length === 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => onAdd(previous.sets, { copied: true })}
              style={[styles.smallButton, { borderColor: theme.primary }]}>
              <ThemedText type="small" style={{ color: theme.primary }}>
                前回と同じ
              </ThemedText>
            </Pressable>
          )}
        </View>
      )}

      {sets.map((s, i) => {
        const timing = timingText(timings?.get(s.id));
        return (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityHint="タップして編集"
            onPress={() => startEditing(s)}
            style={[
              styles.setRow,
              editingId === s.id && { backgroundColor: theme.backgroundSelected },
            ]}>
            <ThemedText themeColor="textSecondary" style={styles.setNumber}>
              {i + 1}
            </ThemedText>
            <View style={styles.flex}>
              <ThemedText>{formatSet(s, format1)}</ThemedText>
              {timing && (
                <ThemedText type="small" themeColor="textSecondary">
                  {timing}
                </ThemedText>
              )}
            </View>
            {prSetIds.has(s.id) && (
              <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                <ThemedText type="smallBold" style={[styles.badgeText, { color: theme.onPrimary }]}>
                  PR
                </ThemedText>
              </View>
            )}
          </Pressable>
        );
      })}

      <View style={styles.inputRow}>
        <InputField
          label="重量"
          value={input.weight}
          placeholder="自重"
          unit="kg"
          active={activeField === 'weight'}
          onPress={() => focus('weight')}
        />
        <ThemedText themeColor="textSecondary">×</ThemedText>
        <InputField
          label="回数"
          value={input.reps}
          placeholder="10"
          unit="回"
          active={activeField === 'reps'}
          onPress={() => focus('reps')}
        />
        <Pressable
          accessibilityRole="button"
          onPress={submit}
          style={[styles.addButton, { backgroundColor: theme.primary }]}>
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
            {editingId != null ? '更新' : '追加'}
          </ThemedText>
        </Pressable>
      </View>

      {activeField && (
        <NumericKeypad
          decimal={FIELD_OPTIONS[activeField].decimal}
          onKey={pressKey}
          onStep={activeField === 'weight' ? step : undefined}
          onClose={() => setActiveField(null)}
        />
      )}

      {editingId != null && (
        <View style={styles.editActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onDelete(editingId);
              stopEditing();
            }}>
            <ThemedText type="small" style={{ color: theme.danger }}>
              このセットを削除
            </ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={stopEditing}>
            <ThemedText type="small" themeColor="textSecondary">
              キャンセル
            </ThemedText>
          </Pressable>
        </View>
      )}

      {error && (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      )}
    </ThemedView>
  );
}

/** テンキー入力用の表示欄(タップで選択)。 */
function InputField({
  label,
  value,
  placeholder,
  unit,
  active,
  onPress,
}: {
  label: string;
  value: string;
  placeholder: string;
  unit: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={{ text: value || placeholder }}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.field,
        {
          borderColor: active ? theme.primary : theme.border,
          borderWidth: active ? 2 : 1,
          backgroundColor: theme.background,
        },
      ]}>
      <ThemedText
        style={[styles.fieldText, !value && { color: theme.textSecondary }]}
        numberOfLines={1}>
        {value || placeholder}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {unit}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: 17,
  },
  previousRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  smallButton: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  setNumber: {
    width: 20,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  badge: {
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    minHeight: 48,
  },
  fieldText: {
    flex: 1,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  addButton: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
