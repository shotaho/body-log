import type { SQLiteDatabase } from 'expo-sqlite';

import { toLocalDateString } from '@/lib/date';

/** 期間内(from 以上 to 未満、ローカル日付)でトレーニングした日と体重を測った日。 */
export async function getActivityDates(
  db: SQLiteDatabase,
  from: Date,
  to: Date
): Promise<{ workoutDates: Set<string>; weighDates: Set<string> }> {
  const workouts = await db.getAllAsync<{ date: string }>(
    `SELECT DISTINCT w.date FROM workout w
     WHERE w.date >= ? AND w.date < ?
       AND EXISTS (SELECT 1 FROM workout_set s WHERE s.workout_id = w.id)`,
    toLocalDateString(from),
    toLocalDateString(to)
  );
  const records = await db.getAllAsync<{ measured_at: number }>(
    'SELECT measured_at FROM body_record WHERE measured_at >= ? AND measured_at < ?',
    from.getTime(),
    to.getTime()
  );
  return {
    workoutDates: new Set(workouts.map((w) => w.date)),
    weighDates: new Set(records.map((r) => toLocalDateString(new Date(r.measured_at)))),
  };
}

export type DayWorkout = { id: number; exerciseNames: string[]; setCount: number };

/** その日のワークアウト(セットのあるもの)。 */
export async function getDayWorkouts(db: SQLiteDatabase, date: string): Promise<DayWorkout[]> {
  const rows = await db.getAllAsync<{ id: number; name: string; sets: number }>(
    `SELECT w.id, e.name, COUNT(s.id) AS sets, MIN(s.set_order) AS first_order
     FROM workout w
     JOIN workout_set s ON s.workout_id = w.id
     JOIN exercise e ON e.id = s.exercise_id
     WHERE w.date = ?
     GROUP BY w.id, e.id ORDER BY w.id, first_order`,
    date
  );
  const byWorkout = new Map<number, DayWorkout>();
  for (const r of rows) {
    const w = byWorkout.get(r.id) ?? { id: r.id, exerciseNames: [], setCount: 0 };
    w.exerciseNames.push(r.name);
    w.setCount += r.sets;
    byWorkout.set(r.id, w);
  }
  return [...byWorkout.values()];
}
