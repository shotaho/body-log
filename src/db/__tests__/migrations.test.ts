import { DatabaseSync } from 'node:sqlite';

import { LATEST_VERSION, migrateDbIfNeeded, type MigratableDatabase } from '../migrations';

/** node:sqlite を expo-sqlite と同じ非同期インターフェースで包む。 */
function wrap(db: DatabaseSync): MigratableDatabase {
  return {
    async execAsync(source) {
      db.exec(source);
    },
    async getFirstAsync<T>(source: string) {
      return (db.prepare(source).get() as T | undefined) ?? null;
    },
    async withTransactionAsync(task) {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

describe('migrateDbIfNeeded', () => {
  it('空のDBに最新スキーマを作成し、プリセット種目を投入する', async () => {
    const db = new DatabaseSync(':memory:');
    await migrateDbIfNeeded(wrap(db));

    expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: LATEST_VERSION });

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all()
      .map((r) => (r as { name: string }).name);
    expect(tables).toEqual([
      'app_setting',
      'body_record',
      'exercise',
      'profile',
      'scale_device',
      'workout',
      'workout_set',
    ]);

    const presets = db.prepare('SELECT COUNT(*) AS n FROM exercise WHERE is_preset = 1').get() as {
      n: number;
    };
    expect(presets.n).toBeGreaterThan(0);
  });

  it('2回実行しても重複適用しない', async () => {
    const db = new DatabaseSync(':memory:');
    await migrateDbIfNeeded(wrap(db));
    const before = db.prepare('SELECT COUNT(*) AS n FROM exercise').get();
    await migrateDbIfNeeded(wrap(db));
    expect(db.prepare('SELECT COUNT(*) AS n FROM exercise').get()).toEqual(before);
  });

  it('ワークアウト削除でセットも削除される(外部キー有効)', async () => {
    const db = new DatabaseSync(':memory:');
    await migrateDbIfNeeded(wrap(db));
    db.exec("INSERT INTO workout (id, date, created_at) VALUES (1, '2026-09-26', 0)");
    db.exec(
      'INSERT INTO workout_set (workout_id, exercise_id, set_order, weight_kg, reps) VALUES (1, 1, 1, 60.0, 10)'
    );
    db.exec('DELETE FROM workout WHERE id = 1');
    expect(db.prepare('SELECT COUNT(*) AS n FROM workout_set').get()).toEqual({ n: 0 });
  });
});
