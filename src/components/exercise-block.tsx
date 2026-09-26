import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { WorkoutSet } from '@/db/workouts';
import { useTheme } from '@/hooks/use-theme';
import { fromLocalDateString } from '@/lib/date';
import { format1 } from '@/lib/decimal';
import { formatSet, parseSetForm, type SetValues } from '@/lib/workout-stats';

type Props = {
  name: string;
  /** このワークアウトでのこの種目のセット(順番どおり) */
  sets: WorkoutSet[];
  /** 前回この種目を行ったときの記録 */
  previous: { date: string; sets: WorkoutSet[] } | null;
  prSetIds: Set<number>;
  onAdd: (sets: SetValues[]) => void;
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

/** ワークアウト内の1種目分。セット一覧と入力欄(追加・編集)を持つ。 */
export function ExerciseBlock({
  name,
  sets,
  previous,
  prSetIds,
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
  const changeInput = (field: 'weight' | 'reps', text: string) =>
    setInput((v) => ({ ...v, [field]: text }));

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
      onAdd([values]);
    }
  };

  const startEditing = (s: WorkoutSet) => {
    setEditingId(s.id);
    setInput(toInput(s));
    setError(undefined);
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
              onPress={() => onAdd(previous.sets)}
              style={[styles.smallButton, { borderColor: theme.primary }]}>
              <ThemedText type="small" style={{ color: theme.primary }}>
                前回と同じ
              </ThemedText>
            </Pressable>
          )}
        </View>
      )}

      {sets.map((s, i) => (
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
          <ThemedText style={styles.flex}>{formatSet(s, format1)}</ThemedText>
          {prSetIds.has(s.id) && (
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <ThemedText type="smallBold" style={[styles.badgeText, { color: theme.onPrimary }]}>
                PR
              </ThemedText>
            </View>
          )}
        </Pressable>
      ))}

      <View style={styles.inputRow}>
        <SetInput
          value={input.weight}
          onChangeText={(text) => changeInput('weight', text)}
          placeholder="自重"
          unit="kg"
          label="重量"
        />
        <ThemedText themeColor="textSecondary">×</ThemedText>
        <SetInput
          value={input.reps}
          onChangeText={(text) => changeInput('reps', text)}
          placeholder="10"
          unit="回"
          label="回数"
          integer
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

function SetInput({
  value,
  onChangeText,
  placeholder,
  unit,
  label,
  integer,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  unit: string;
  label: string;
  integer?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[styles.setInput, { borderColor: theme.border, backgroundColor: theme.background }]}>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        keyboardType={integer ? 'number-pad' : 'decimal-pad'}
        selectTextOnFocus
        style={[styles.setInputText, { color: theme.text }]}
      />
      <ThemedText type="small" themeColor="textSecondary">
        {unit}
      </ThemedText>
    </View>
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
  setInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  setInputText: {
    flex: 1,
    fontSize: 18,
    paddingVertical: Spacing.two,
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
