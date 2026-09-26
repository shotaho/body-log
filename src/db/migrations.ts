/**
 * SQLite のスキーマ定義とマイグレーション。
 * `PRAGMA user_version` で適用済みバージョンを管理し、未適用分だけを順に実行する。
 * 既存のマイグレーションは書き換えず、変更は必ず末尾に追加すること。
 */

/** expo-sqlite の SQLiteDatabase のうち、マイグレーションで使う部分だけ。テストで差し替えられるようにする。 */
export interface MigratableDatabase {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export const BODY_PARTS = {
  chest: '胸',
  back: '背中',
  legs: '脚',
  shoulders: '肩',
  arms: '腕',
  abs: '腹',
  other: 'その他',
} as const;

export type BodyPart = keyof typeof BODY_PARTS;

const PRESET_EXERCISES: [name: string, bodyPart: BodyPart][] = [
  ['ベンチプレス', 'chest'],
  ['インクラインダンベルプレス', 'chest'],
  ['ダンベルフライ', 'chest'],
  ['デッドリフト', 'back'],
  ['ラットプルダウン', 'back'],
  ['ベントオーバーロウ', 'back'],
  ['懸垂', 'back'],
  ['スクワット', 'legs'],
  ['レッグプレス', 'legs'],
  ['ルーマニアンデッドリフト', 'legs'],
  ['ショルダープレス', 'shoulders'],
  ['サイドレイズ', 'shoulders'],
  ['バーベルカール', 'arms'],
  ['トライセプスエクステンション', 'arms'],
  ['クランチ', 'abs'],
];

const sqlString = (s: string) => `'${s.replace(/'/g, "''")}'`;

const MIGRATIONS: string[] = [
  // v1: 初期スキーマ
  `
  CREATE TABLE app_setting (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE TABLE profile (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    height_cm  REAL,
    birth_date TEXT,
    sex        TEXT CHECK (sex IN ('male', 'female'))
  );

  CREATE TABLE scale_device (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    mac_address TEXT NOT NULL UNIQUE,
    model       TEXT,
    name        TEXT,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE body_record (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    measured_at  INTEGER NOT NULL,
    weight_kg    REAL NOT NULL,
    body_fat_pct REAL,
    muscle_kg    REAL,
    water_pct    REAL,
    bone_kg      REAL,
    visceral_fat REAL,
    bmr_kcal     INTEGER,
    bmi          REAL,
    impedance    INTEGER,
    source       TEXT NOT NULL CHECK (source IN ('manual', 'scale')),
    note         TEXT
  );
  CREATE INDEX idx_body_record_measured_at ON body_record (measured_at);

  CREATE TABLE exercise (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL UNIQUE,
    body_part TEXT NOT NULL,
    is_preset INTEGER NOT NULL DEFAULT 0,
    archived  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE workout (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    date       TEXT NOT NULL,
    note       TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_workout_date ON workout (date);

  CREATE TABLE workout_set (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id  INTEGER NOT NULL REFERENCES workout (id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercise (id),
    set_order   INTEGER NOT NULL,
    weight_kg   REAL NOT NULL,
    reps        INTEGER NOT NULL
  );
  CREATE INDEX idx_workout_set_workout ON workout_set (workout_id);
  CREATE INDEX idx_workout_set_exercise ON workout_set (exercise_id);

  INSERT INTO exercise (name, body_part, is_preset) VALUES
  ${PRESET_EXERCISES.map(([name, part]) => `(${sqlString(name)}, ${sqlString(part)}, 1)`).join(',\n  ')};
  `,
];

export const LATEST_VERSION = MIGRATIONS.length;

export async function migrateDbIfNeeded(db: MigratableDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let version = current + 1; version <= LATEST_VERSION; version++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version - 1]);
      await db.execAsync(`PRAGMA user_version = ${version}`);
    });
  }
}
