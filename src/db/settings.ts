import type { SQLiteDatabase } from 'expo-sqlite';

/** app_setting テーブル(キー・バリュー)の読み書き。 */

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_setting WHERE key = ?',
    key
  );
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO app_setting (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}
