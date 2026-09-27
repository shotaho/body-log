import type { SQLiteDatabase } from 'expo-sqlite';

import type { Sex } from '@/lib/scale/body-composition';

export type Profile = { heightCm: number | null; birthDate: string | null; sex: Sex | null };

export const EMPTY_PROFILE: Profile = { heightCm: null, birthDate: null, sex: null };

export async function getProfile(db: SQLiteDatabase): Promise<Profile> {
  const row = await db.getFirstAsync<{
    height_cm: number | null;
    birth_date: string | null;
    sex: Sex | null;
  }>('SELECT height_cm, birth_date, sex FROM profile WHERE id = 1');
  return row ? { heightCm: row.height_cm, birthDate: row.birth_date, sex: row.sex } : EMPTY_PROFILE;
}

export async function saveProfile(db: SQLiteDatabase, profile: Profile): Promise<void> {
  await db.runAsync(
    `INSERT INTO profile (id, height_cm, birth_date, sex) VALUES (1, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       height_cm = excluded.height_cm, birth_date = excluded.birth_date, sex = excluded.sex`,
    profile.heightCm,
    profile.birthDate,
    profile.sex
  );
}

/** 体組成の計算に必要な項目がそろっているか。 */
export function isProfileComplete(
  profile: Profile
): profile is { heightCm: number; birthDate: string; sex: Sex } {
  return profile.heightCm != null && profile.birthDate != null && profile.sex != null;
}
