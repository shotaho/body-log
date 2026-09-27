import type { SQLiteDatabase } from 'expo-sqlite';

export type ScaleDevice = {
  id: number;
  macAddress: string;
  model: string | null;
  name: string | null;
};

/** 登録済みの体重計(1台のみ運用)。 */
export async function getRegisteredScale(db: SQLiteDatabase): Promise<ScaleDevice | null> {
  const row = await db.getFirstAsync<{
    id: number;
    mac_address: string;
    model: string | null;
    name: string | null;
  }>('SELECT id, mac_address, model, name FROM scale_device ORDER BY id DESC LIMIT 1');
  return row ? { id: row.id, macAddress: row.mac_address, model: row.model, name: row.name } : null;
}

/** 体重計を登録する。既存の登録は置き換える。 */
export async function registerScale(
  db: SQLiteDatabase,
  device: { macAddress: string; model: string; name: string | null }
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM scale_device');
    await db.runAsync(
      'INSERT INTO scale_device (mac_address, model, name, created_at) VALUES (?, ?, ?, ?)',
      device.macAddress,
      device.model,
      device.name,
      Date.now()
    );
  });
}

export async function unregisterScale(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM scale_device');
}
