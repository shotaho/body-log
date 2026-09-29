import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { RestTimerBar } from '@/components/rest-timer-bar';
import { useRestTimer } from '@/components/rest-timer-provider';
import { DateTimeField } from '@/components/date-time-field';
import { ExerciseCard } from '@/components/exercise-card';
import { ExercisePicker } from '@/components/exercise-picker';
import { Card } from '@/components/card';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  addSets,
  deleteSet,
  deleteWorkout,
  deleteWorkoutIfEmpty,
  finishWorkout,
  getPreviousSession,
  getWorkout,
  listExercises,
  listRecentExerciseIds,
  listSets,
  listSetsBefore,
  updateSet,
  updateWorkout,
  type Exercise,
  type Workout,
  type WorkoutSet,
} from '@/db/workouts';
import { useTheme } from '@/hooks/use-theme';
import { fromLocalDateString, toLocalDateString } from '@/lib/date';
import { setTimings } from '@/lib/rest-timer';
import { bestOf, personalRecordSetIds, totalVolume, type Best } from '@/lib/workout-stats';

type ExerciseContext = {
  previous: { date: string; sets: WorkoutSet[] } | null;
  priorBest: Best | null;
};

/** 最初から出しておく「記録のある種目」の上限 */
const LOGGED_EXERCISE_LIMIT = 50;

const unique = (ids: number[]) => [...new Set(ids)];

const formatVolume = (kg: number) => Math.round(kg).toLocaleString('ja-JP');

/** 記録した時刻からわかるトレーニング時間(分)。わからなければ null */
function workoutMinutes(sets: WorkoutSet[]): number | null {
  const times = sets.flatMap((s) => [s.startedAt, s.completedAt]).filter((t) => t != null);
  if (times.length < 2) {
    return null;
  }
  return Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / 60_000));
}

export default function WorkoutScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = Number(id);
  const restTimer = useRestTimer();

  // undefined: 読み込み中 / null: 見つからない
  const [workout, setWorkout] = useState<Workout | null>();
  const [note, setNote] = useState('');
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [exercises, setExercises] = useState<Map<number, Exercise>>(new Map());
  /** 開いた時点でこのワークアウトにセットがあった種目(セットを行った順) */
  const [workoutIds, setWorkoutIds] = useState<number[]>([]);
  /** 過去に記録のある種目(最近使った順)。選ばなくても最初から出しておく */
  const [loggedIds, setLoggedIds] = useState<number[]>([]);
  /** 「種目を追加」で追加した種目 */
  const [pendingIds, setPendingIds] = useState<number[]>([]);
  /** 開いている種目カード */
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [contexts, setContexts] = useState<Map<number, ExerciseContext>>(new Map());
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    (async () => {
      const [w, all, s, recent] = await Promise.all([
        getWorkout(db, workoutId),
        listExercises(db),
        listSets(db, workoutId),
        listRecentExerciseIds(db, LOGGED_EXERCISE_LIMIT),
      ]);
      const available = new Set(all.map((e) => e.id));
      const inWorkout = unique(s.map((set) => set.exerciseId));
      setExercises(new Map(all.map((e) => [e.id, e])));
      setWorkoutIds(inWorkout);
      setLoggedIds(recent.filter((e) => available.has(e) && !inWorkout.includes(e)));
      setExpanded(new Set(inWorkout));
      setSets(s);
      setNote(w?.note ?? '');
      setWorkout(w);
    })();
    // 何も記録せずに戻ったときは空のワークアウトを残さない
    return () => {
      deleteWorkoutIfEmpty(db, workoutId);
    };
  }, [db, workoutId]);

  /**
   * 画面に出す種目: このワークアウトの種目 → 追加した種目 → 記録のある種目。
   * セットを記録しても並びは変えない(入力中に種目が移動しないように)。
   */
  const topIds = useMemo(() => unique([...workoutIds, ...pendingIds]), [workoutIds, pendingIds]);
  const restIds = useMemo(() => loggedIds.filter((e) => !topIds.includes(e)), [loggedIds, topIds]);
  const exerciseIds = useMemo(() => [...topIds, ...restIds], [topIds, restIds]);

  // 各種目の「前回」と、このワークアウトより前のベスト(PR 判定用)を読み込む
  useEffect(() => {
    if (!workout) {
      return;
    }
    let active = true;
    Promise.all(
      exerciseIds.map(async (exerciseId) => {
        const [previous, before] = await Promise.all([
          getPreviousSession(db, exerciseId, workout),
          listSetsBefore(db, exerciseId, workout),
        ]);
        return [exerciseId, { previous, priorBest: bestOf(before) }] as const;
      })
    ).then((entries) => active && setContexts(new Map(entries)));
    return () => {
      active = false;
    };
  }, [db, workout, exerciseIds]);

  const reloadSets = useCallback(async () => {
    setSets(await listSets(db, workoutId));
  }, [db, workoutId]);

  const timings = useMemo(() => setTimings(sets), [sets]);

  if (workout === undefined) {
    return null;
  }
  if (workout === null) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText themeColor="textSecondary">ワークアウトが見つかりません</ThemedText>
      </ScrollView>
    );
  }

  const changeDate = async (date: Date) => {
    const next = { ...workout, date: toLocalDateString(date) };
    await updateWorkout(db, workout.id, { date: next.date, note: note.trim() || null });
    setWorkout(next);
  };

  const changeNote = (text: string) => {
    setNote(text);
    updateWorkout(db, workout.id, { date: workout.date, note: text.trim() || null });
  };

  /** 当日のワークアウトだけ、レストタイマーとセット・レスト時間の記録を行う(過去日の後入力では行わない) */
  const isToday = workout.date === toLocalDateString(new Date());

  const toggle = (exerciseId: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(exerciseId)) {
        next.add(exerciseId);
      }
      return next;
    });

  const finish = async () => {
    await finishWorkout(db, workout.id, Date.now());
    restTimer.dismiss();
    router.push({ pathname: '/workout/summary/[id]', params: { id: workout.id } });
  };

  const confirmDelete = () =>
    Alert.alert('このワークアウトを削除しますか?', '記録したセットもすべて削除されます。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await deleteWorkout(db, workout.id);
          router.back();
        },
      },
    ]);

  const renderCard = (exerciseId: number) => {
    const exerciseSets = sets.filter((s) => s.exerciseId === exerciseId);
    const context = contexts.get(exerciseId);
    // 「前回」の読み込みを待ってから出す(予定のセットの初期値に使うため)
    if (!context) {
      return null;
    }
    return (
      <ExerciseCard
        key={exerciseId}
        name={exercises.get(exerciseId)?.name ?? '(削除された種目)'}
        sets={exerciseSets}
        previous={context.previous}
        prSetIds={personalRecordSetIds(context.priorBest, exerciseSets)}
        timings={timings}
        expanded={expanded.has(exerciseId)}
        onToggle={() => toggle(exerciseId)}
        onComplete={async (values) => {
          if (isToday) {
            const now = Date.now();
            const startedAt = restTimer.onSetCompleted(now);
            await addSets(db, workout.id, exerciseId, [{ ...values, startedAt, completedAt: now }]);
          } else {
            // 過去日の後入力は、実際の時刻がわからないので記録しない
            await addSets(db, workout.id, exerciseId, [values]);
          }
          await reloadSets();
        }}
        onUpdate={async (setId, values) => {
          await updateSet(db, setId, values);
          await reloadSets();
        }}
        onDelete={async (setId) => {
          await deleteSet(db, setId);
          await reloadSets();
        }}
        onOpenHistory={() =>
          router.push({ pathname: '/workout/exercise/[id]', params: { id: exerciseId } })
        }
      />
    );
  };

  const minutes = workoutMinutes(sets);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <RestTimerBar />
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Card>
          <DateTimeField
            mode="date"
            value={fromLocalDateString(workout.date)}
            onChange={changeDate}
          />
          <View style={styles.stats}>
            <Stat label="総ボリューム" value={formatVolume(totalVolume(sets))} unit="kg" />
            <Stat label="セット" value={String(sets.length)} />
            <Stat label="時間" value={minutes != null ? String(minutes) : '-'} unit="分" />
          </View>
        </Card>

        {topIds.map(renderCard)}

        {topIds.length === 0 && (
          <ThemedText themeColor="textSecondary">
            {restIds.length > 0
              ? '下の種目をタップして開き、終わったセットにチェックを付けていきましょう'
              : '「種目を追加」から記録を始めましょう'}
          </ThemedText>
        )}

        {restIds.length > 0 && (
          <ThemedText type="smallBold" themeColor="textSecondary">
            記録のある種目
          </ThemedText>
        )}
        {restIds.map(renderCard)}

        <TextField label="メモ(任意)" value={note} onChangeText={changeNote} multiline />

        <Button title="このワークアウトを削除" variant="danger" onPress={confirmDelete} />
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { backgroundColor: theme.background, borderTopColor: theme.border },
        ]}>
        <View style={styles.flex}>
          <Button title="種目を追加" variant="secondary" onPress={() => setPickerVisible(true)} />
        </View>
        <View style={styles.flex}>
          <Button title="トレーニング終了" onPress={finish} disabled={sets.length === 0} />
        </View>
      </View>

      {pickerVisible && (
        <ExercisePicker
          excludeIds={topIds}
          onClose={() => setPickerVisible(false)}
          onSelect={(exercise) => {
            setExercises((prev) => new Map(prev).set(exercise.id, exercise));
            setPendingIds((prev) => [...prev, exercise.id]);
            setExpanded((prev) => new Set(prev).add(exercise.id));
            setPickerVisible(false);
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.statValue}>
        {value}
        {unit && value !== '-' && <ThemedText type="small"> {unit}</ThemedText>}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  stats: {
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    gap: Spacing.half,
  },
  statValue: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  bottomBar: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
