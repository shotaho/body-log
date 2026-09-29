import type { SQLiteDatabase } from 'expo-sqlite';

import {
  backupFileName,
  exportBackup,
  importBackup,
  InvalidBackupError,
  parseBackup,
} from '../backup';
import { insertBodyRecord, insertScaleRecord, listBodyRecords } from '../body-records';
import { getProfile, saveProfile } from '../profile';
import { getRegisteredScale, registerScale } from '../scale-devices';
import { createTestDb } from '../testing/node-sqlite';
import {
  addSets,
  findOrCreateWorkout,
  insertExercise,
  listExercises,
  listSets,
  listWorkouts,
} from '../workouts';

async function seed(db: SQLiteDatabase) {
  await saveProfile(db, { heightCm: 175, birthDate: '1990-05-01', sex: 'male' });
  await registerScale(db, { macAddress: 'AA:BB', model: 'XMTZC05HM', name: null });
  await insertBodyRecord(db, {
    measuredAt: 1000,
    weightKg: 65.3,
    bodyFatPct: 18.2,
    note: '朝',
  });
  await insertScaleRecord(db, {
    scaleKey: 'AA:BB|2026-09-27 07:30:15',
    measuredAt: 2000,
    weightKg: 65.1,
    impedance: 480,
    bmi: 21.3,
    bodyFatPct: 18,
    muscleKg: 50.1,
    waterPct: 55,
    boneKg: 2.8,
    visceralFat: 9,
    bmrKcal: 1500,
  });
  const custom = await insertExercise(db, 'ケーブルクロス', 'chest');
  const workout = await findOrCreateWorkout(db, '2026-09-27');
  await addSets(db, workout, custom, [
    { weightKg: 20, reps: 12 },
    { weightKg: 22.5, reps: 10 },
  ]);
}

describe('バックアップ', () => {
  it('書き出したデータを別の DB に取り込むと同じ内容になる', async () => {
    const source = await createTestDb();
    await seed(source);
    const json = JSON.stringify(await exportBackup(source, new Date(2026, 8, 27)));

    const target = await createTestDb();
    // 取り込み先の既存データは置き換えられる
    await insertBodyRecord(target, { measuredAt: 1, weightKg: 99, bodyFatPct: null, note: null });
    await importBackup(target, parseBackup(json));

    expect(await listBodyRecords(target)).toEqual(await listBodyRecords(source));
    expect(await listExercises(target)).toEqual(await listExercises(source));
    expect(await listWorkouts(target)).toEqual(await listWorkouts(source));
    const [workout] = await listWorkouts(target);
    expect(await listSets(target, workout.id)).toEqual(await listSets(source, workout.id));
    expect(await getProfile(target)).toEqual(await getProfile(source));
    expect(await getRegisteredScale(target)).toEqual(await getRegisteredScale(source));
  });

  it('古いスキーマ(scale_key 列なし)のバックアップも取り込める', async () => {
    const source = await createTestDb();
    await seed(source);
    const backup = await exportBackup(source);
    backup.schemaVersion = 1;
    backup.tables.body_record = backup.tables.body_record.map(({ scale_key: _, ...rest }) => rest);

    const target = await createTestDb();
    await importBackup(target, parseBackup(JSON.stringify(backup)));
    expect(await listBodyRecords(target)).toHaveLength(2);
  });

  it('未知の列は無視する', async () => {
    const source = await createTestDb();
    await seed(source);
    const backup = await exportBackup(source);
    backup.tables.body_record[0]['evil); DROP TABLE workout; --'] = 1;

    const target = await createTestDb();
    await importBackup(target, parseBackup(JSON.stringify(backup)));
    expect(await listWorkouts(target)).toHaveLength(1);
  });

  it('不正なファイルは取り込まない', async () => {
    expect(() => parseBackup('not json')).toThrow(InvalidBackupError);
    expect(() => parseBackup('{"app":"other"}')).toThrow(
      'body-log のバックアップファイルではありません'
    );

    const source = await createTestDb();
    const backup = await exportBackup(source);
    expect(() => parseBackup(JSON.stringify({ ...backup, schemaVersion: 999 }))).toThrow(
      '新しいバージョン'
    );
    const broken = { ...backup, tables: { ...backup.tables, workout: [{ date: { x: 1 } }] } };
    expect(() => parseBackup(JSON.stringify(broken))).toThrow('workout のデータが不正です');
  });

  it('取り込みに失敗したら元のデータのまま', async () => {
    const target = await createTestDb();
    await seed(target);
    const before = await listBodyRecords(target);
    const bad = await exportBackup(target);
    // 存在しないワークアウトを参照するセット → 外部キー違反
    bad.tables.workout = [];
    await expect(importBackup(target, bad)).rejects.toThrow();
    expect(await listBodyRecords(target)).toEqual(before);
  });

  it('ファイル名に日付が入る', () => {
    expect(backupFileName(new Date(2026, 8, 7))).toBe('body-log-backup-20260907.json');
  });
});
