import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { RestTimerBar } from '@/components/rest-timer-bar';
import { useRestTimer } from '@/components/rest-timer-provider';
import { DateTimeField } from '@/components/date-time-field';
import { ExerciseBlock } from '@/components/exercise-block';
import { ExercisePicker } from '@/components/exercise-picker';
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
import { bestOf, personalRecordSetIds, type Best } from '@/lib/workout-stats';

type ExerciseContext = {
  previous: { date: string; sets: WorkoutSet[] } | null;
  priorBest: Best | null;
};

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
  /** 追加したがまだセットのない種目 */
  const [pendingIds, setPendingIds] = useState<number[]>([]);
  const [contexts, setContexts] = useState<Map<number, ExerciseContext>>(new Map());
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    (async () => {
      const [w, all, s] = await Promise.all([
        getWorkout(db, workoutId),
        listExercises(db),
        listSets(db, workoutId),
      ]);
      setExercises(new Map(all.map((e) => [e.id, e])));
      setSets(s);
      setNote(w?.note ?? '');
      setWorkout(w);
    })();
    // 何も記録せずに戻ったときは空のワークアウトを残さない
    return () => {
      deleteWorkoutIfEmpty(db, workoutId);
    };
  }, [db, workoutId]);

  /** 画面に出す種目の順番: セットを最初に行った順 → 追加したがセットのない種目 */
  const exerciseIds = useMemo(() => {
    const ids: number[] = [];
    for (const s of sets) {
      if (!ids.includes(s.exerciseId)) {
        ids.push(s.exerciseId);
      }
    }
    return [...ids, ...pendingIds.filter((p) => !ids.includes(p))];
  }, [sets, pendingIds]);

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

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <RestTimerBar />
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <DateTimeField
          mode="date"
          value={fromLocalDateString(workout.date)}
          onChange={changeDate}
        />

        {exerciseIds.map((exerciseId) => {
          const exerciseSets = sets.filter((s) => s.exerciseId === exerciseId);
          const context = contexts.get(exerciseId);
          // 「前回」の読み込みを待ってから出す(入力欄の初期値に使うため)
          if (!context) {
            return null;
          }
          return (
            <ExerciseBlock
              key={exerciseId}
              name={exercises.get(exerciseId)?.name ?? '(削除された種目)'}
              sets={exerciseSets}
              previous={context.previous}
              prSetIds={personalRecordSetIds(context.priorBest, exerciseSets)}
              timings={timings}
              onAdd={async (values, { copied }) => {
                if (copied || !isToday) {
                  // 前回のコピーや過去日の入力は、実際の時刻がわからないので記録しない
                  await addSets(db, workout.id, exerciseId, values);
                } else {
                  const now = Date.now();
                  const startedAt = restTimer.onSetCompleted(now);
                  await addSets(db, workout.id, exerciseId, [
                    { ...values[0], startedAt, completedAt: now },
                  ]);
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
        })}

        {exerciseIds.length === 0 && (
          <ThemedText themeColor="textSecondary">種目を追加して記録を始めましょう</ThemedText>
        )}

        <Button title="種目を追加" onPress={() => setPickerVisible(true)} />

        {sets.length > 0 && <Button title="トレーニング終了" onPress={finish} />}

        <TextField label="メモ(任意)" value={note} onChangeText={changeNote} multiline />

        <Button title="このワークアウトを削除" variant="danger" onPress={confirmDelete} />
      </ScrollView>

      {pickerVisible && (
        <ExercisePicker
          excludeIds={exerciseIds}
          onClose={() => setPickerVisible(false)}
          onSelect={(exercise) => {
            setExercises((prev) => new Map(prev).set(exercise.id, exercise));
            setPendingIds((prev) => [...prev, exercise.id]);
            setPickerVisible(false);
          }}
        />
      )}
    </KeyboardAvoidingView>
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
});
