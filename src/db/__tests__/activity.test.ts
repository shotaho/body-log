import { getActivityDates, getDayWorkouts } from '../activity';
import { insertBodyRecord } from '../body-records';
import { createTestDb } from '../testing/node-sqlite';
import { addSets, findOrCreateWorkout, listExercises } from '../workouts';

describe('activity', () => {
  it('月内のトレーニング日と計測日、その日のワークアウトを返す', async () => {
    const db = await createTestDb();
    const [bench, squat] = await listExercises(db);

    const w1 = await findOrCreateWorkout(db, '2026-09-20');
    await addSets(db, w1, squat.id, [{ weightKg: 100, reps: 5 }]);
    await addSets(db, w1, bench.id, [
      { weightKg: 60, reps: 10 },
      { weightKg: 60, reps: 8 },
    ]);
    await findOrCreateWorkout(db, '2026-09-21'); // セットなし → 数えない
    const outside = await findOrCreateWorkout(db, '2026-10-01');
    await addSets(db, outside, bench.id, [{ weightKg: 60, reps: 10 }]);

    for (const [day, hour] of [
      [22, 7],
      [22, 22],
      [30, 23],
    ]) {
      const measuredAt = new Date(2026, 8, day, hour).getTime();
      await insertBodyRecord(db, { measuredAt, weightKg: 65, bodyFatPct: null, note: null });
    }

    const { workoutDates, weighDates } = await getActivityDates(
      db,
      new Date(2026, 8, 1),
      new Date(2026, 9, 1)
    );
    expect([...workoutDates]).toEqual(['2026-09-20']);
    expect([...weighDates].sort()).toEqual(['2026-09-22', '2026-09-30']);

    expect(await getDayWorkouts(db, '2026-09-20')).toEqual([
      { id: w1, exerciseNames: [squat.name, bench.name], setCount: 3 },
    ]);
    expect(await getDayWorkouts(db, '2026-09-21')).toEqual([]);
  });
});
