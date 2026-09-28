import type { SQLiteDatabase } from 'expo-sqlite';

import type { BodyPart } from '@/db/migrations';
import { round1 } from '@/lib/decimal';

export type Exercise = { id: number; name: string; bodyPart: BodyPart; isPreset: boolean };

export type Workout = {
  id: number;
  date: string;
  note: string | null;
  /** 「トレーニング終了」を押した時刻。未終了なら null */
  finishedAt: number | null;
};

export type WorkoutSet = {
  id: number;
  workoutId: number;
  exerciseId: number;
  setOrder: number;
  weightKg: number;
  reps: number;
  /** セット開始時刻(レストタイマー終了時刻)。不明なら null */
  startedAt: number | null;
  /** セット完了時刻(記録した時刻)。前回のコピーなどで不明なら null */
  completedAt: number | null;
};

export type WorkoutSummary = Workout & {
  setCount: number;
  volumeKg: number;
  /** 種目名(ワークアウト内で最初に行った順) */
  exerciseNames: string[];
};

type SetRow = {
  id: number;
  workout_id: number;
  exercise_id: number;
  set_order: number;
  weight_kg: number;
  reps: number;
  started_at: number | null;
  completed_at: number | null;
};

const fromSetRow = (r: SetRow): WorkoutSet => ({
  id: r.id,
  workoutId: r.workout_id,
  exerciseId: r.exercise_id,
  setOrder: r.set_order,
  weightKg: r.weight_kg,
  reps: r.reps,
  startedAt: r.started_at,
  completedAt: r.completed_at,
});

// ---- 種目 ----

export async function listExercises(db: SQLiteDatabase): Promise<Exercise[]> {
  const rows = await db.getAllAsync<{
    id: number;
    name: string;
    body_part: BodyPart;
    is_preset: number;
  }>('SELECT id, name, body_part, is_preset FROM exercise WHERE archived = 0 ORDER BY id');
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    bodyPart: r.body_part,
    isPreset: r.is_preset === 1,
  }));
}

export async function getExercise(db: SQLiteDatabase, id: number): Promise<Exercise | null> {
  const r = await db.getFirstAsync<{
    id: number;
    name: string;
    body_part: BodyPart;
    is_preset: number;
  }>('SELECT id, name, body_part, is_preset FROM exercise WHERE id = ?', id);
  return r ? { id: r.id, name: r.name, bodyPart: r.body_part, isPreset: r.is_preset === 1 } : null;
}

export class DuplicateExerciseError extends Error {}

/** 種目を追加して id を返す。同名(前後空白を除く)があれば DuplicateExerciseError。 */
export async function insertExercise(
  db: SQLiteDatabase,
  name: string,
  bodyPart: BodyPart
): Promise<number> {
  const trimmed = name.trim();
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM exercise WHERE name = ?',
    trimmed
  );
  if (existing) {
    throw new DuplicateExerciseError(trimmed);
  }
  const result = await db.runAsync(
    'INSERT INTO exercise (name, body_part) VALUES (?, ?)',
    trimmed,
    bodyPart
  );
  return result.lastInsertRowId;
}

// ---- ワークアウト ----

/** 新しい順のワークアウト一覧(セットのないものも含む)。 */
export async function listWorkouts(db: SQLiteDatabase): Promise<WorkoutSummary[]> {
  const workouts = await db.getAllAsync<{
    id: number;
    date: string;
    note: string | null;
    finished_at: number | null;
    set_count: number;
    volume: number | null;
  }>(
    `SELECT w.id, w.date, w.note, w.finished_at, COUNT(s.id) AS set_count, SUM(s.weight_kg * s.reps) AS volume
     FROM workout w LEFT JOIN workout_set s ON s.workout_id = w.id
     GROUP BY w.id ORDER BY w.date DESC, w.id DESC`
  );
  const names = await db.getAllAsync<{ workout_id: number; name: string }>(
    `SELECT s.workout_id, e.name, MIN(s.set_order) AS first_order
     FROM workout_set s JOIN exercise e ON e.id = s.exercise_id
     GROUP BY s.workout_id, s.exercise_id ORDER BY s.workout_id, first_order`
  );
  const namesByWorkout = new Map<number, string[]>();
  for (const n of names) {
    namesByWorkout.set(n.workout_id, [...(namesByWorkout.get(n.workout_id) ?? []), n.name]);
  }
  return workouts.map((w) => ({
    id: w.id,
    date: w.date,
    note: w.note,
    finishedAt: w.finished_at,
    setCount: w.set_count,
    volumeKg: w.volume ?? 0,
    exerciseNames: namesByWorkout.get(w.id) ?? [],
  }));
}

export async function getWorkout(db: SQLiteDatabase, id: number): Promise<Workout | null> {
  return db.getFirstAsync<Workout>(
    'SELECT id, date, note, finished_at AS finishedAt FROM workout WHERE id = ?',
    id
  );
}

/** 「トレーニング終了」を記録する(何度押しても最初の終了時刻を残す)。 */
export async function finishWorkout(db: SQLiteDatabase, id: number, at: number): Promise<void> {
  await db.runAsync(
    'UPDATE workout SET finished_at = COALESCE(finished_at, ?) WHERE id = ?',
    at,
    id
  );
}

/** その日のワークアウトがあればその id、なければ作成して id を返す。 */
export async function findOrCreateWorkout(db: SQLiteDatabase, date: string): Promise<number> {
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM workout WHERE date = ? ORDER BY id DESC LIMIT 1',
    date
  );
  if (existing) {
    return existing.id;
  }
  const result = await db.runAsync(
    'INSERT INTO workout (date, created_at) VALUES (?, ?)',
    date,
    Date.now()
  );
  return result.lastInsertRowId;
}

export async function updateWorkout(
  db: SQLiteDatabase,
  id: number,
  values: { date: string; note: string | null }
): Promise<void> {
  await db.runAsync(
    'UPDATE workout SET date = ?, note = ? WHERE id = ?',
    values.date,
    values.note,
    id
  );
}

export async function deleteWorkout(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM workout WHERE id = ?', id);
}

/** セットもメモもないワークアウトを削除する(記録画面を開いて何もせず戻った場合の後始末)。 */
export async function deleteWorkoutIfEmpty(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync(
    `DELETE FROM workout WHERE id = ? AND (note IS NULL OR note = '')
     AND NOT EXISTS (SELECT 1 FROM workout_set WHERE workout_id = workout.id)`,
    id
  );
}

// ---- セット ----

export async function listSets(db: SQLiteDatabase, workoutId: number): Promise<WorkoutSet[]> {
  const rows = await db.getAllAsync<SetRow>(
    'SELECT * FROM workout_set WHERE workout_id = ? ORDER BY set_order',
    workoutId
  );
  return rows.map(fromSetRow);
}

export async function addSets(
  db: SQLiteDatabase,
  workoutId: number,
  exerciseId: number,
  sets: { weightKg: number; reps: number; startedAt?: number | null; completedAt?: number | null }[]
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ max_order: number | null }>(
      'SELECT MAX(set_order) AS max_order FROM workout_set WHERE workout_id = ?',
      workoutId
    );
    let order = row?.max_order ?? 0;
    for (const s of sets) {
      order += 1;
      await db.runAsync(
        `INSERT INTO workout_set
           (workout_id, exercise_id, set_order, weight_kg, reps, started_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        workoutId,
        exerciseId,
        order,
        round1(s.weightKg),
        s.reps,
        s.startedAt ?? null,
        s.completedAt ?? null
      );
    }
  });
}

export async function updateSet(
  db: SQLiteDatabase,
  id: number,
  values: { weightKg: number; reps: number }
): Promise<void> {
  await db.runAsync(
    'UPDATE workout_set SET weight_kg = ?, reps = ? WHERE id = ?',
    round1(values.weightKg),
    values.reps,
    id
  );
}

export async function deleteSet(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM workout_set WHERE id = ?', id);
}

// ---- 履歴 ----

/** workout より前(日付が前、同日なら id が小さい)のワークアウトを表す SQL 条件。 */
const BEFORE = '(w.date < ? OR (w.date = ? AND w.id < ?))';

/** 指定ワークアウトより前で、その種目を行った直近のワークアウトのセット。なければ null。 */
export async function getPreviousSession(
  db: SQLiteDatabase,
  exerciseId: number,
  current: Workout
): Promise<{ date: string; sets: WorkoutSet[] } | null> {
  const prev = await db.getFirstAsync<{ id: number; date: string }>(
    `SELECT w.id, w.date FROM workout w
     WHERE EXISTS (SELECT 1 FROM workout_set s WHERE s.workout_id = w.id AND s.exercise_id = ?)
       AND ${BEFORE}
     ORDER BY w.date DESC, w.id DESC LIMIT 1`,
    exerciseId,
    current.date,
    current.date,
    current.id
  );
  if (!prev) {
    return null;
  }
  const rows = await db.getAllAsync<SetRow>(
    'SELECT * FROM workout_set WHERE workout_id = ? AND exercise_id = ? ORDER BY set_order',
    prev.id,
    exerciseId
  );
  return { date: prev.date, sets: rows.map(fromSetRow) };
}

/** 指定ワークアウトより前の、その種目の全セット(PR 判定用)。 */
export async function listSetsBefore(
  db: SQLiteDatabase,
  exerciseId: number,
  current: Workout
): Promise<WorkoutSet[]> {
  const rows = await db.getAllAsync<SetRow>(
    `SELECT s.* FROM workout_set s JOIN workout w ON w.id = s.workout_id
     WHERE s.exercise_id = ? AND ${BEFORE}`,
    exerciseId,
    current.date,
    current.date,
    current.id
  );
  return rows.map(fromSetRow);
}

export type HistorySet = WorkoutSet & { date: string };

/** 種目の全履歴(日付昇順、同日内はワークアウト・セット順)。 */
export async function getExerciseHistory(
  db: SQLiteDatabase,
  exerciseId: number
): Promise<HistorySet[]> {
  const rows = await db.getAllAsync<SetRow & { date: string }>(
    `SELECT s.*, w.date FROM workout_set s JOIN workout w ON w.id = s.workout_id
     WHERE s.exercise_id = ? ORDER BY w.date, w.id, s.set_order`,
    exerciseId
  );
  return rows.map((r) => ({ ...fromSetRow(r), date: r.date }));
}

/** 最近使った種目の id(最後に行った日が新しい順)。 */
export async function listRecentExerciseIds(db: SQLiteDatabase, limit: number): Promise<number[]> {
  const rows = await db.getAllAsync<{ exercise_id: number }>(
    `SELECT s.exercise_id FROM workout_set s JOIN workout w ON w.id = s.workout_id
     GROUP BY s.exercise_id ORDER BY MAX(w.date) DESC, MAX(s.id) DESC LIMIT ?`,
    limit
  );
  return rows.map((r) => r.exercise_id);
}

export type BodyPartVolume = { date: string; bodyPart: BodyPart; volumeKg: number };

/** 日付 × 部位ごとの総ボリューム(重量×回数の合計)。日付昇順。 */
export async function listBodyPartDailyVolume(db: SQLiteDatabase): Promise<BodyPartVolume[]> {
  const rows = await db.getAllAsync<{ date: string; body_part: BodyPart; volume: number }>(
    `SELECT w.date, e.body_part, SUM(s.weight_kg * s.reps) AS volume
     FROM workout_set s
     JOIN workout w ON w.id = s.workout_id
     JOIN exercise e ON e.id = s.exercise_id
     GROUP BY w.date, e.body_part ORDER BY w.date`
  );
  return rows.map((r) => ({ date: r.date, bodyPart: r.body_part, volumeKg: r.volume }));
}
