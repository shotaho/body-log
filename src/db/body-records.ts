import type { SQLiteDatabase } from 'expo-sqlite';

import { round1 } from '@/lib/decimal';

export type BodyRecord = {
  id: number;
  measuredAt: number;
  weightKg: number;
  bodyFatPct: number | null;
  source: 'manual' | 'scale';
  note: string | null;
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
};

const COLUMNS = 'id, measured_at, weight_kg, body_fat_pct, source, note';

function fromRow(row: Row): BodyRecord {
  return {
    id: row.id,
    measuredAt: row.measured_at,
    weightKg: row.weight_kg,
    bodyFatPct: row.body_fat_pct,
    source: row.source,
    note: row.note,
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
