import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { NumericKeypad } from '@/components/numeric-keypad';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { WorkoutSet } from '@/db/workouts';
import { useTheme } from '@/hooks/use-theme';
import { fromLocalDateString } from '@/lib/date';
import { applyKey, stepWeight, type KeypadKey } from '@/lib/keypad';
import { formatDuration, type SetTiming } from '@/lib/rest-timer';
import { initialPlan, nextDraft, shortSet, toDraft, type SetDraft } from '@/lib/set-plan';
import { parseSetForm, type SetValues } from '@/lib/workout-stats';

type Field = 'weight' | 'reps';

const FIELD_OPTIONS: Record<Field, { decimal: boolean; maxIntDigits: number }> = {
  weight: { decimal: true, maxIntDigits: 4 },
  reps: { decimal: false, maxIntDigits: 3 },
};

/** 予定のセット(まだ完了していない行) */
type PlanRow = SetDraft & { key: number };

/** テンキーで編集中の欄。予定の行は key、完了した行はセットの id で指す */
type Target =
  | { kind: 'plan'; key: number; field: Field }
  | { kind: 'done'; id: number; field: Field };

type Props = {
  name: string;
  /** このワークアウトで完了したこの種目のセット(順番どおり) */
  sets: WorkoutSet[];
  /** 前回この種目を行ったときの記録 */
  previous: { date: string; sets: WorkoutSet[] } | null;
  prSetIds: Set<number>;
  /** セットごとのセット時間・レスト時間 */
  timings?: Map<number, SetTiming>;
  expanded: boolean;
  onToggle: () => void;
  /** 予定のセットにチェックを付けた(完了した) */
  onComplete: (values: SetValues) => void;
  onUpdate: (id: number, values: SetValues) => void;
  onDelete: (id: number) => void;
  onOpenHistory: () => void;
};

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

const sameValues = (a: SetValues, b: SetValues) => a.weightKg === b.weightKg && a.reps === b.reps;

/**
 * ワークアウト内の1種目分のカード。
 * 前回の記録から予定のセットを並べておき、終わったセットにチェックを付けていく(チェックで記録)。
 * 重量・回数は欄をタップしてアプリ内テンキーで直す。完了したセットも直せる。
 */
export function ExerciseCard({
  name,
  sets,
  previous,
  prSetIds,
  timings,
  expanded,
  onToggle,
  onComplete,
  onUpdate,
  onDelete,
  onOpenHistory,
}: Props) {
  const theme = useTheme();
  const [plan, setPlan] = useState<PlanRow[]>(() =>
    initialPlan(previous?.sets ?? null, sets.length).map((d, i) => ({ ...d, key: i }))
  );
  const [nextKey, setNextKey] = useState(() => (previous?.sets.length ?? 0) + 1);
  /** 完了したセットを編集中の値(セット id ごと) */
  const [edits, setEdits] = useState<Map<number, SetDraft>>(new Map());
  const [target, setTarget] = useState<Target | null>(null);
  /** 欄を選んだ直後の最初のキーは、今の値を置き換える */
  const [replaceNext, setReplaceNext] = useState(false);
  const [error, setError] = useState<string>();

  const doneDraft = (s: WorkoutSet) => edits.get(s.id) ?? toDraft(s);

  /** 完了したセットの編集を保存する(値が正しく、変わっていれば) */
  const commit = (t: Target | null) => {
    if (t?.kind !== 'done') {
      return;
    }
    const set = sets.find((s) => s.id === t.id);
    const draft = edits.get(t.id);
    if (!set || !draft) {
      return;
    }
    setEdits((prev) => {
      const next = new Map(prev);
      next.delete(t.id);
      return next;
    });
    const result = parseSetForm(draft.weight, draft.reps);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const values = { weightKg: result.weightKg, reps: result.reps };
    if (!sameValues(values, set)) {
      onUpdate(set.id, values);
    }
  };

  const select = (next: Target) => {
    if (target && !(target.kind === next.kind && sameRow(target, next))) {
      commit(target);
    }
    setTarget(next);
    setReplaceNext(true);
    setError(undefined);
  };

  const closeKeypad = () => {
    commit(target);
    setTarget(null);
  };

  const editValue = (t: Target, update: (value: string) => string) => {
    if (t.kind === 'plan') {
      setPlan((rows) =>
        rows.map((r) => (r.key === t.key ? { ...r, [t.field]: update(r[t.field]) } : r))
      );
    } else {
      const set = sets.find((s) => s.id === t.id);
      if (set) {
        const draft = doneDraft(set);
        setEdits((prev) =>
          new Map(prev).set(t.id, { ...draft, [t.field]: update(draft[t.field]) })
        );
      }
    }
  };

  const pressKey = (key: KeypadKey) => {
    if (!target) {
      return;
    }
    const replace = replaceNext && key !== 'back';
    editValue(target, (v) => applyKey(replace ? '' : v, key, FIELD_OPTIONS[target.field]));
    setReplaceNext(false);
  };

  const step = (delta: number) => {
    if (target) {
      editValue({ ...target, field: 'weight' }, (v) => stepWeight(v, delta));
      setReplaceNext(false);
    }
  };

  const complete = (row: PlanRow) => {
    const result = parseSetForm(row.weight, row.reps);
    if (!result.ok) {
      select({ kind: 'plan', key: row.key, field: row.reps ? 'weight' : 'reps' });
      setError(result.error);
      return;
    }
    if (target?.kind === 'plan' && target.key === row.key) {
      setTarget(null);
    }
    setError(undefined);
    setPlan((rows) => rows.filter((r) => r.key !== row.key));
    onComplete({ weightKg: result.weightKg, reps: result.reps });
  };

  /** チェックを外す: 記録を消して、同じ値の予定のセットに戻す */
  const uncheck = (set: WorkoutSet) => {
    if (target?.kind === 'done' && target.id === set.id) {
      setTarget(null);
    }
    setPlan((rows) => [{ ...doneDraft(set), key: nextKey }, ...rows]);
    setNextKey((k) => k + 1);
    onDelete(set.id);
  };

  const addRow = () => {
    const last = plan.at(-1) ?? (sets.length > 0 ? doneDraft(sets[sets.length - 1]) : undefined);
    setPlan((rows) => [...rows, { ...nextDraft(last), key: nextKey }]);
    setNextKey((k) => k + 1);
  };

  const removeRow = () => {
    const last = plan.at(-1);
    if (!last) {
      return;
    }
    if (target?.kind === 'plan' && target.key === last.key) {
      setTarget(null);
    }
    setPlan((rows) => rows.slice(0, -1));
  };

  const total = sets.length + plan.length;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.titleRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityHint={expanded ? '閉じる' : '開いてセットを記録する'}
          onPress={onToggle}
          style={styles.titleButton}>
          <MaterialIcons
            name={expanded ? 'expand-less' : 'expand-more'}
            size={22}
            color={theme.textSecondary}
          />
          <ThemedText type="smallBold" style={styles.title} numberOfLines={1}>
            {name}
          </ThemedText>
          {sets.length > 0 && (
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              {expanded ? `${sets.length}/${total}` : `${sets.length}セット`}
            </ThemedText>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name}の履歴`}
          onPress={onOpenHistory}
          hitSlop={8}>
          <MaterialIcons name="show-chart" size={22} color={theme.textSecondary} />
        </Pressable>
      </View>

      {!expanded && previous && (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          前回 {shortDate(previous.date)}: {previous.sets.map(shortSet).join(', ')}
        </ThemedText>
      )}

      {expanded && (
        <>
          <View style={styles.row}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.setCol}>
              セット
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.prevCol}>
              前回{previous ? ` ${shortDate(previous.date)}` : ''}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.valueHeader}>
              kg
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.valueHeader}>
              回
            </ThemedText>
            <View style={styles.checkCol} />
          </View>

          {sets.map((s, i) => {
            const draft = doneDraft(s);
            const timing = timingText(timings?.get(s.id));
            return (
              <View key={`d${s.id}`}>
                <View
                  style={[
                    styles.row,
                    styles.doneRow,
                    { backgroundColor: theme.backgroundSelected },
                  ]}>
                  <View style={styles.setCol}>
                    <ThemedText style={styles.setNumber}>{i + 1}</ThemedText>
                    {prSetIds.has(s.id) && (
                      <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                        <ThemedText
                          type="smallBold"
                          style={[styles.badgeText, { color: theme.onPrimary }]}>
                          PR
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  <PreviousCell set={previous?.sets[i]} />
                  <ValueCell
                    label={`${i + 1}セット目の重量`}
                    value={draft.weight}
                    placeholder="自重"
                    active={isTarget(target, { kind: 'done', id: s.id, field: 'weight' })}
                    onPress={() => select({ kind: 'done', id: s.id, field: 'weight' })}
                  />
                  <ValueCell
                    label={`${i + 1}セット目の回数`}
                    value={draft.reps}
                    placeholder="-"
                    active={isTarget(target, { kind: 'done', id: s.id, field: 'reps' })}
                    onPress={() => select({ kind: 'done', id: s.id, field: 'reps' })}
                  />
                  <CheckButton
                    checked
                    label={`${i + 1}セット目の完了を取り消す`}
                    onPress={() => uncheck(s)}
                  />
                </View>
                {timing && (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.timing}>
                    {timing}
                  </ThemedText>
                )}
              </View>
            );
          })}

          {plan.map((row, j) => {
            const n = sets.length + j + 1;
            return (
              <View key={`p${row.key}`} style={styles.row}>
                <View style={styles.setCol}>
                  <ThemedText style={styles.setNumber} themeColor="textSecondary">
                    {n}
                  </ThemedText>
                </View>
                <PreviousCell set={previous?.sets[n - 1]} />
                <ValueCell
                  label={`${n}セット目の重量`}
                  value={row.weight}
                  placeholder="自重"
                  active={isTarget(target, { kind: 'plan', key: row.key, field: 'weight' })}
                  onPress={() => select({ kind: 'plan', key: row.key, field: 'weight' })}
                />
                <ValueCell
                  label={`${n}セット目の回数`}
                  value={row.reps}
                  placeholder="-"
                  active={isTarget(target, { kind: 'plan', key: row.key, field: 'reps' })}
                  onPress={() => select({ kind: 'plan', key: row.key, field: 'reps' })}
                />
                <CheckButton
                  checked={false}
                  label={`${n}セット目を完了`}
                  onPress={() => complete(row)}
                />
              </View>
            );
          })}

          {error && (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {error}
            </ThemedText>
          )}

          {target && (
            <NumericKeypad
              decimal={FIELD_OPTIONS[target.field].decimal}
              onKey={pressKey}
              onStep={target.field === 'weight' ? step : undefined}
              onClose={closeKeypad}
            />
          )}

          <View style={styles.rowActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: plan.length === 0 }}
              disabled={plan.length === 0}
              onPress={removeRow}
              style={[styles.rowAction, plan.length === 0 && styles.dimmed]}>
              <MaterialIcons name="remove" size={18} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                セット削除
              </ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={addRow} style={styles.rowAction}>
              <MaterialIcons name="add" size={18} color={theme.primary} />
              <ThemedText type="smallBold" style={{ color: theme.primary }}>
                セット追加
              </ThemedText>
            </Pressable>
          </View>
        </>
      )}
    </ThemedView>
  );
}

function sameRow(a: Target, b: Target): boolean {
  if (a.kind === 'plan' && b.kind === 'plan') {
    return a.key === b.key;
  }
  if (a.kind === 'done' && b.kind === 'done') {
    return a.id === b.id;
  }
  return false;
}

function isTarget(current: Target | null, t: Target): boolean {
  return current != null && sameRow(current, t) && current.field === t.field;
}

function PreviousCell({ set }: { set: SetValues | undefined }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.prevCol} numberOfLines={1}>
      {set ? shortSet(set) : '-'}
    </ThemedText>
  );
}

/** テンキー入力用の値の欄(タップで選択)。 */
function ValueCell({
  label,
  value,
  placeholder,
  active,
  onPress,
}: {
  label: string;
  value: string;
  placeholder: string;
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
        styles.valueCell,
        {
          borderColor: active ? theme.primary : 'transparent',
          backgroundColor: theme.background,
        },
      ]}>
      <ThemedText
        style={[styles.valueText, !value && { color: theme.textSecondary }]}
        numberOfLines={1}>
        {value || placeholder}
      </ThemedText>
    </Pressable>
  );
}

function CheckButton({
  checked,
  label,
  onPress,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={onPress}
      hitSlop={4}
      style={[
        styles.checkCol,
        styles.check,
        checked
          ? { backgroundColor: theme.primary, borderColor: theme.primary }
          : { borderColor: theme.border, backgroundColor: theme.background },
      ]}>
      <MaterialIcons
        name="check"
        size={22}
        color={checked ? theme.onPrimary : theme.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  titleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 32,
  },
  title: {
    flex: 1,
    fontSize: 17,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  doneRow: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.one,
  },
  setCol: {
    width: 32,
    alignItems: 'center',
  },
  setNumber: {
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  prevCol: {
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  valueHeader: {
    width: 64,
    textAlign: 'center',
  },
  valueCell: {
    width: 64,
    minHeight: 44,
    borderRadius: Spacing.two,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    fontSize: 18,
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
  },
  checkCol: {
    width: 40,
  },
  check: {
    height: 40,
    borderRadius: Spacing.two,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 14,
  },
  timing: {
    textAlign: 'right',
    paddingRight: Spacing.one,
  },
  rowActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  dimmed: {
    opacity: 0.4,
  },
});
