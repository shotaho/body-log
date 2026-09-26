/**
 * テスト専用: node:sqlite を expo-sqlite の SQLiteDatabase と同じ非同期 API で包む。
 * DB モジュールの SQL を Jest から実際の SQLite で検証するために使う。
 */
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

import { migrateDbIfNeeded } from '../migrations';

type Params = SQLInputValue[];

function flatten(params: unknown[]): Params {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0] as Params;
  }
  return params as Params;
}

export function wrapNodeSqlite(db: DatabaseSync) {
  const wrapped = {
    async execAsync(source: string) {
      db.exec(source);
    },
    async getFirstAsync<T>(source: string, ...params: unknown[]) {
      return (db.prepare(source).get(...flatten(params)) as T | undefined) ?? null;
    },
    async getAllAsync<T>(source: string, ...params: unknown[]) {
      return db.prepare(source).all(...flatten(params)) as T[];
    },
    async runAsync(source: string, ...params: unknown[]) {
      const result = db.prepare(source).run(...flatten(params));
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    async withTransactionAsync(task: () => Promise<void>) {
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
  return wrapped as unknown as SQLiteDatabase;
}

/** マイグレーション済みのインメモリ DB。 */
export async function createTestDb(): Promise<SQLiteDatabase> {
  const db = wrapNodeSqlite(new DatabaseSync(':memory:'));
  await migrateDbIfNeeded(db);
  return db;
}
