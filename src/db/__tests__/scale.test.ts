import type { SQLiteDatabase } from 'expo-sqlite';

import { toScaleRecord } from '@/lib/scale/record';

import { getBodyRecord, hasScaleRecord, insertScaleRecord, listBodyRecords } from '../body-records';
import { EMPTY_PROFILE, getProfile, isProfileComplete, saveProfile } from '../profile';
import { getRegisteredScale, registerScale, unregisterScale } from '../scale-devices';
import { createTestDb } from '../testing/node-sqlite';

let db: SQLiteDatabase;

beforeEach(async () => {
  db = await createTestDb();
});

const result = {
  key: '2026-09-27 07:30:15',
  weightKg: 65.3,
  impedance: 480,
  measuredAt: new Date(2026, 8, 27, 7, 30, 15),
};
const now = new Date(2026, 8, 27, 7, 31);

describe('プロフィール', () => {
  it('未設定なら空、保存すると読み出せる', async () => {
    expect(await getProfile(db)).toEqual(EMPTY_PROFILE);
    const profile = { heightCm: 175, birthDate: '1990-05-01', sex: 'male' as const };
    await saveProfile(db, profile);
    await saveProfile(db, profile); // 2回目は更新
    expect(await getProfile(db)).toEqual(profile);
    expect(isProfileComplete(profile)).toBe(true);
    expect(isProfileComplete({ ...profile, sex: null })).toBe(false);
  });
});

describe('体重計の登録', () => {
  it('1台だけ登録され、登録し直すと置き換わる', async () => {
    expect(await getRegisteredScale(db)).toBeNull();
    await registerScale(db, { macAddress: 'AA:BB', model: 'XMTZC05HM', name: 'MIBFS' });
    await registerScale(db, { macAddress: 'CC:DD', model: 'XMTZC05HM', name: null });
    expect((await getRegisteredScale(db))?.macAddress).toBe('CC:DD');
    await unregisterScale(db);
    expect(await getRegisteredScale(db)).toBeNull();
  });
});

describe('体重計からの記録', () => {
  it('体組成付きで保存し、同じ計測は二重に保存しない', async () => {
    await saveProfile(db, { heightCm: 175, birthDate: '1990-05-01', sex: 'male' });
    const input = toScaleRecord(result, 'AA:BB', await getProfile(db), now);

    expect(await hasScaleRecord(db, input.scaleKey)).toBe(false);
    expect(await insertScaleRecord(db, input)).toBe(true);
    expect(await insertScaleRecord(db, input)).toBe(false);
    expect(await hasScaleRecord(db, input.scaleKey)).toBe(true);

    const [record] = await listBodyRecords(db);
    expect(record).toMatchObject({
      source: 'scale',
      weightKg: 65.3,
      measuredAt: result.measuredAt.getTime(),
    });
    expect(record.bodyFatPct).not.toBeNull();
    expect(record.composition.impedance).toBe(480);
    expect(record.composition.bmi).toBeCloseTo(21.3, 1);
    expect((await getBodyRecord(db, record.id))?.composition.muscleKg).not.toBeNull();
  });

  it('プロフィール未設定なら体重だけ保存する', async () => {
    const input = toScaleRecord(result, 'AA:BB', EMPTY_PROFILE, now);
    expect(input).toMatchObject({ weightKg: 65.3, impedance: 480, bmi: null, bodyFatPct: null });
    await insertScaleRecord(db, input);
    const [record] = await listBodyRecords(db);
    expect(record.composition.muscleKg).toBeNull();
  });
});
