import type { SQLiteDatabase } from 'expo-sqlite';

import { LATEST_VERSION } from '@/db/migrations';

/**
 * JSON バックアップ(機種変更時の移行用)。
 * 端末ごとの設定(テーマなどの app_setting)は含めない。
 * 取り込みは既存データをすべて置き換える。
 */

/** 親→子の順。削除は逆順で行う。 */
const TABLES = [
  'profile',
  'scale_device',
  'exercise',
  'body_record',
  'workout',
  'workout_set',
] as const;

type Table = (typeof TABLES)[number];
type Value = string | number | null;
type Row = Record<string, Value>;

export type Backup = {
  app: 'body-log';
  /** 書き出し時のスキーマバージョン */
  schemaVersion: number;
  exportedAt: string;
  tables: Record<Table, Row[]>;
};

export class InvalidBackupError extends Error {}

export async function exportBackup(db: SQLiteDatabase, now = new Date()): Promise<Backup> {
  const tables = {} as Record<Table, Row[]>;
  for (const table of TABLES) {
    tables[table] = await db.getAllAsync<Row>(`SELECT * FROM ${table} ORDER BY rowid`);
  }
  return { app: 'body-log', schemaVersion: LATEST_VERSION, exportedAt: now.toISOString(), tables };
}

/** 形式を検証して Backup として返す。不正なら InvalidBackupError。 */
export function parseBackup(json: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new InvalidBackupError('JSON として読み込めませんでした');
  }
  const d = data as Partial<Backup> | null;
  if (!d || d.app !== 'body-log' || typeof d.schemaVersion !== 'number' || !d.tables) {
    throw new InvalidBackupError('body-log のバックアップファイルではありません');
  }
  if (d.schemaVersion > LATEST_VERSION) {
    throw new InvalidBackupError(
      '新しいバージョンのアプリで作られたバックアップです。アプリを更新してください'
    );
  }
  for (const table of TABLES) {
    const rows = d.tables[table];
    if (!Array.isArray(rows)) {
      throw new InvalidBackupError(`${table} のデータがありません`);
    }
    for (const row of rows) {
      if (typeof row !== 'object' || row === null || Array.isArray(row)) {
        throw new InvalidBackupError(`${table} のデータが不正です`);
      }
      for (const value of Object.values(row)) {
        if (value !== null && typeof value !== 'string' && typeof value !== 'number') {
          throw new InvalidBackupError(`${table} のデータが不正です`);
        }
      }
    }
  }
  return d as Backup;
}

/**
 * バックアップで全データを置き換える。1トランザクションで行い、失敗したら元のまま。
 * 古いスキーマのバックアップにない列は既定値(NULL など)になる。未知の列は無視する。
 */
export async function importBackup(db: SQLiteDatabase, backup: Backup): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const table of [...TABLES].reverse()) {
      await db.runAsync(`DELETE FROM ${table}`);
    }
    for (const table of TABLES) {
      // 列名は DB の実際の列に限定する(SQL に埋め込むため、ファイルの値をそのまま使わない)
      const columns = new Set(
        (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).map((c) => c.name)
      );
      for (const row of backup.tables[table]) {
        const keys = Object.keys(row).filter((k) => columns.has(k));
        if (keys.length === 0) {
          continue;
        }
        await db.runAsync(
          `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          keys.map((k) => row[k])
        );
      }
    }
  });
}

/** ファイル名用: body-log-backup-20260927.json */
export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `body-log-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.json`;
}
