import type { SQLiteDatabase } from 'expo-sqlite';

import { createTestDb } from '../testing/node-sqlite';
import {
  addSets,
  deleteWorkoutIfEmpty,
  DuplicateExerciseError,
  findOrCreateWorkout,
  finishWorkout,
  getExerciseHistory,
  getPreviousSession,
  getWorkout,
  insertExercise,
  listBodyPartDailyVolume,
  listExercises,
  listRecentExerciseIds,
  listSets,
  listSetsBefore,
  listWorkouts,
  updateSet,
  updateWorkout,
} from '../workouts';

let db: SQLiteDatabase;
let bench: number;
let squat: number;

beforeEach(async () => {
  db = await createTestDb();
  const exercises = await listExercises(db);
  bench = exercises.find((e) => e.name === 'ベンチプレス')!.id;
  squat = exercises.find((e) => e.name === 'スクワット')!.id;
});

describe('種目', () => {
  it('プリセットに加えて追加でき、同名は拒否する', async () => {
    const id = await insertExercise(db, ' ケーブルクロス ', 'chest');
    const added = (await listExercises(db)).find((e) => e.id === id);
    expect(added).toEqual({ id, name: 'ケーブルクロス', bodyPart: 'chest', isPreset: false });
    await expect(insertExercise(db, 'ケーブルクロス', 'chest')).rejects.toBeInstanceOf(
      DuplicateExerciseError
    );
  });
});

describe('ワークアウト', () => {
  it('同じ日は既存のワークアウトを返す', async () => {
    const a = await findOrCreateWorkout(db, '2026-09-26');
    const b = await findOrCreateWorkout(db, '2026-09-26');
    expect(b).toBe(a);
  });

  it('セットを追加すると通し番号が振られ、一覧に集計が出る', async () => {
    const id = await findOrCreateWorkout(db, '2026-09-26');
    await addSets(db, id, squat, [{ weightKg: 100, reps: 5 }]);
    await addSets(db, id, bench, [
      { weightKg: 60, reps: 10 },
      { weightKg: 62.46, reps: 8 },
    ]);
    const sets = await listSets(db, id);
    expect(sets.map((s) => [s.setOrder, s.exerciseId, s.weightKg])).toEqual([
      [1, squat, 100],
      [2, bench, 60],
      [3, bench, 62.5], // 小数点第1位に丸めて保存
    ]);

    const [summary] = await listWorkouts(db);
    expect(summary).toMatchObject({
      id,
      setCount: 3,
      volumeKg: 500 + 600 + 500,
      exerciseNames: ['スクワット', 'ベンチプレス'],
      exercises: [
        { exerciseId: squat, name: 'スクワット', sets: [{ weightKg: 100, reps: 5 }] },
        {
          exerciseId: bench,
          name: 'ベンチプレス',
          sets: [
            { weightKg: 60, reps: 10 },
            { weightKg: 62.5, reps: 8 },
          ],
        },
      ],
    });
  });

  it('空のワークアウトだけを削除する', async () => {
    const empty = await findOrCreateWorkout(db, '2026-09-25');
    const withNote = await findOrCreateWorkout(db, '2026-09-26');
    await updateWorkout(db, withNote, { date: '2026-09-26', note: '胸の日' });
    await deleteWorkoutIfEmpty(db, empty);
    await deleteWorkoutIfEmpty(db, withNote);
    expect(await getWorkout(db, empty)).toBeNull();
    expect(await getWorkout(db, withNote)).not.toBeNull();
  });
});

describe('履歴', () => {
  async function session(date: string, sets: { weightKg: number; reps: number }[]) {
    const id = await findOrCreateWorkout(db, date);
    await addSets(db, id, bench, sets);
    return (await getWorkout(db, id))!;
  }

  it('前回(直前のワークアウト)のセットを返す', async () => {
    await session('2026-09-10', [{ weightKg: 55, reps: 10 }]);
    await session('2026-09-20', [
      { weightKg: 60, reps: 10 },
      { weightKg: 60, reps: 8 },
    ]);
    const today = (await getWorkout(db, await findOrCreateWorkout(db, '2026-09-26')))!;

    const prev = await getPreviousSession(db, bench, today);
    expect(prev?.date).toBe('2026-09-20');
    expect(prev?.sets.map((s) => s.reps)).toEqual([10, 8]);
    expect(await getPreviousSession(db, squat, today)).toBeNull();

    // 過去の記録を開いたときは、それより前が「前回」
    const mid = (await getWorkout(db, await findOrCreateWorkout(db, '2026-09-20')))!;
    expect((await getPreviousSession(db, bench, mid))?.date).toBe('2026-09-10');
    expect((await listSetsBefore(db, bench, mid)).map((s) => s.weightKg)).toEqual([55]);
  });

  it('種目の全履歴を日付順に返す', async () => {
    await session('2026-09-20', [{ weightKg: 60, reps: 10 }]);
    await session('2026-09-10', [{ weightKg: 55, reps: 10 }]);
    const history = await getExerciseHistory(db, bench);
    expect(history.map((h) => [h.date, h.weightKg])).toEqual([
      ['2026-09-10', 55],
      ['2026-09-20', 60],
    ]);
  });

  it('セットを更新できる', async () => {
    const w = await session('2026-09-20', [{ weightKg: 60, reps: 10 }]);
    const [set] = await listSets(db, w.id);
    await updateSet(db, set.id, { weightKg: 65, reps: 6 });
    expect((await listSets(db, w.id))[0]).toMatchObject({ weightKg: 65, reps: 6 });
  });
});

describe('v3: 時刻・終了・最近の種目・部位別ボリューム', () => {
  it('セットの開始・完了時刻を保存する(省略時は null)', async () => {
    const id = await findOrCreateWorkout(db, '2026-09-29');
    await addSets(db, id, bench, [
      { weightKg: 60, reps: 10, startedAt: 1000, completedAt: 40_000 },
      { weightKg: 60, reps: 8 },
    ]);
    const sets = await listSets(db, id);
    expect(sets.map((s) => [s.startedAt, s.completedAt])).toEqual([
      [1000, 40_000],
      [null, null],
    ]);
  });

  it('トレーニング終了時刻は最初の1回だけ記録する', async () => {
    const id = await findOrCreateWorkout(db, '2026-09-29');
    expect((await getWorkout(db, id))?.finishedAt).toBeNull();
    await finishWorkout(db, id, 5000);
    await finishWorkout(db, id, 9000);
    expect((await getWorkout(db, id))?.finishedAt).toBe(5000);
  });

  it('最近使った種目は最後に行った日が新しい順', async () => {
    const w1 = await findOrCreateWorkout(db, '2026-09-20');
    await addSets(db, w1, squat, [{ weightKg: 100, reps: 5 }]);
    const w2 = await findOrCreateWorkout(db, '2026-09-25');
    await addSets(db, w2, bench, [{ weightKg: 60, reps: 10 }]);
    expect(await listRecentExerciseIds(db, 5)).toEqual([bench, squat]);
    expect(await listRecentExerciseIds(db, 1)).toEqual([bench]);
  });

  it('日付 × 部位ごとの総ボリューム', async () => {
    const w1 = await findOrCreateWorkout(db, '2026-09-20');
    await addSets(db, w1, bench, [
      { weightKg: 60, reps: 10 },
      { weightKg: 50, reps: 10 },
    ]);
    await addSets(db, w1, squat, [{ weightKg: 100, reps: 5 }]);
    const w2 = await findOrCreateWorkout(db, '2026-09-22');
    await addSets(db, w2, bench, [{ weightKg: 70, reps: 5 }]);
    expect(await listBodyPartDailyVolume(db)).toEqual([
      { date: '2026-09-20', bodyPart: 'chest', volumeKg: 1100 },
      { date: '2026-09-20', bodyPart: 'legs', volumeKg: 500 },
      { date: '2026-09-22', bodyPart: 'chest', volumeKg: 350 },
    ]);
  });
});
