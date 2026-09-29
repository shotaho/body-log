import type { SQLiteDatabase } from 'expo-sqlite';

import { round1 } from '@/lib/decimal';

export type BodyRecord = {
  id: number;
  measuredAt: number;
  weightKg: number;
  bodyFatPct: number | null;
  source: 'manual' | 'scale';
  note: string | null;
  /** 体重計から取得した場合の体組成(手動入力では null) */
  composition: {
    muscleKg: number | null;
    waterPct: number | null;
    boneKg: number | null;
    visceralFat: number | null;
    bmrKcal: number | null;
    bmi: number | null;
    impedance: number | null;
  };
};

export type BodyRecordInput = {
  measuredAt: number;
  weightKg: number;
  bodyFatPct: number | null;
  note: string | null;
};

type Row = {
  id: number;
  measured_at: number;
  weight_kg: number;
  body_fat_pct: number | null;
  source: 'manual' | 'scale';
  note: string | null;
  muscle_kg: number | null;
  water_pct: number | null;
  bone_kg: number | null;
  visceral_fat: number | null;
  bmr_kcal: number | null;
  bmi: number | null;
  impedance: number | null;
};

const COLUMNS = `id, measured_at, weight_kg, body_fat_pct, source, note,
  muscle_kg, water_pct, bone_kg, visceral_fat, bmr_kcal, bmi, impedance`;

function fromRow(row: Row): BodyRecord {
  return {
    id: row.id,
    measuredAt: row.measured_at,
    weightKg: row.weight_kg,
    bodyFatPct: row.body_fat_pct,
    source: row.source,
    note: row.note,
    composition: {
      muscleKg: row.muscle_kg,
      waterPct: row.water_pct,
      boneKg: row.bone_kg,
      visceralFat: row.visceral_fat,
      bmrKcal: row.bmr_kcal,
      bmi: row.bmi,
      impedance: row.impedance,
    },
  };
}

/** 新しい順に全件。 */
export async function listBodyRecords(db: SQLiteDatabase): Promise<BodyRecord[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT ${COLUMNS} FROM body_record ORDER BY measured_at DESC, id DESC`
  );
  return rows.map(fromRow);
}

export async function getBodyRecord(db: SQLiteDatabase, id: number): Promise<BodyRecord | null> {
  const row = await db.getFirstAsync<Row>(`SELECT ${COLUMNS} FROM body_record WHERE id = ?`, id);
  return row ? fromRow(row) : null;
}

export async function insertBodyRecord(db: SQLiteDatabase, input: BodyRecordInput): Promise<void> {
  await db.runAsync(
    `INSERT INTO body_record (measured_at, weight_kg, body_fat_pct, source, note)
     VALUES (?, ?, ?, 'manual', ?)`,
    input.measuredAt,
    round1(input.weightKg),
    input.bodyFatPct == null ? null : round1(input.bodyFatPct),
    input.note
  );
}

export async function updateBodyRecord(
  db: SQLiteDatabase,
  id: number,
  input: BodyRecordInput
): Promise<void> {
  await db.runAsync(
    `UPDATE body_record SET measured_at = ?, weight_kg = ?, body_fat_pct = ?, note = ? WHERE id = ?`,
    input.measuredAt,
    round1(input.weightKg),
    input.bodyFatPct == null ? null : round1(input.bodyFatPct),
    input.note,
    id
  );
}

export async function deleteBodyRecord(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM body_record WHERE id = ?', id);
}

export type ScaleRecordInput = {
  /** 体重計ID + 体重計の時計。同じ計測の二重保存防止に使う */
  scaleKey: string;
  measuredAt: number;
  weightKg: number;
  impedance: number | null;
  bmi: number | null;
  bodyFatPct: number | null;
  muscleKg: number | null;
  waterPct: number | null;
  boneKg: number | null;
  visceralFat: number | null;
  bmrKcal: number | null;
};

const round1OrNull = (v: number | null) => (v == null ? null : round1(v));

/** その計測がすでに保存済みか。 */
export async function hasScaleRecord(db: SQLiteDatabase, scaleKey: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM body_record WHERE scale_key = ?',
    scaleKey
  );
  return row != null;
}

/** 体重計からの記録を保存する。同じ計測が保存済みなら何もせず false。 */
export async function insertScaleRecord(
  db: SQLiteDatabase,
  input: ScaleRecordInput
): Promise<boolean> {
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO body_record (
       measured_at, weight_kg, body_fat_pct, muscle_kg, water_pct, bone_kg, visceral_fat,
       bmr_kcal, bmi, impedance, source, scale_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scale', ?)`,
    input.measuredAt,
    round1(input.weightKg),
    round1OrNull(input.bodyFatPct),
    round1OrNull(input.muscleKg),
    round1OrNull(input.waterPct),
    round1OrNull(input.boneKg),
    round1OrNull(input.visceralFat),
    input.bmrKcal == null ? null : Math.round(input.bmrKcal),
    round1OrNull(input.bmi),
    input.impedance,
    input.scaleKey
  );
  return result.changes > 0;
}

/** 期間内(from 以上 to 未満)の記録を古い順に。 */
export async function listBodyRecordsBetween(
  db: SQLiteDatabase,
  from: Date,
  to: Date
): Promise<BodyRecord[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT ${COLUMNS} FROM body_record WHERE measured_at >= ? AND measured_at < ?
     ORDER BY measured_at, id`,
    from.getTime(),
    to.getTime()
  );
  return rows.map(fromRow);
}
