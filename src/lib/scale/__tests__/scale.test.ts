import { ageOn, bmi, computeBodyComposition } from '../body-composition';
import { INITIAL_MEASUREMENT, recordedAt, reduceMeasurement } from '../measurement';
import { base64ToBytes, parseMiScale2, type MiScale2Packet } from '../mi-scale2';

/** Mi Body Composition Scale 2 のサービスデータ(13バイト)を組み立てる。 */
function packetBytes({
  control0 = 0x02,
  stabilized = false,
  loadRemoved = false,
  impedance = 0,
  weightRaw,
  time = [2026, 9, 27, 7, 30, 15],
}: {
  control0?: number;
  stabilized?: boolean;
  loadRemoved?: boolean;
  impedance?: number;
  weightRaw: number;
  time?: number[];
}): Uint8Array {
  const control1 = (impedance ? 0x02 : 0) | (stabilized ? 0x20 : 0) | (loadRemoved ? 0x80 : 0);
  const [y, mo, d, h, mi, s] = time;
  return new Uint8Array([
    control0,
    control1,
    y & 0xff,
    y >> 8,
    mo,
    d,
    h,
    mi,
    s,
    impedance & 0xff,
    impedance >> 8,
    weightRaw & 0xff,
    weightRaw >> 8,
  ]);
}

const packet = (opts: Parameters<typeof packetBytes>[0]) => parseMiScale2(packetBytes(opts))!;

describe('parseMiScale2', () => {
  it('kg 表示の確定体重とインピーダンスを読む', () => {
    const p = packet({ weightRaw: 13060, stabilized: true, impedance: 480 });
    expect(p).toMatchObject({
      unit: 'kg',
      weightKg: 65.3,
      impedance: 480,
      stabilized: true,
      loadRemoved: false,
      timestamp: '2026-09-27 07:30:15',
    });
    expect(p.measuredAt).toEqual(new Date(2026, 8, 27, 7, 30, 15));
  });

  it('lbs・斤は kg に換算する', () => {
    expect(packet({ control0: 0x03, weightRaw: 14400 }).weightKg).toBeCloseTo(65.317, 3);
    expect(packet({ control0: 0x12, weightRaw: 13060 }).weightKg).toBeCloseTo(65.3, 3);
  });

  it('インピーダンスのフラグがない・異常値なら null', () => {
    expect(packet({ weightRaw: 13060 }).impedance).toBeNull();
    expect(packet({ weightRaw: 13060, impedance: 65534 }).impedance).toBeNull();
  });

  it('長さが違うデータは無視する', () => {
    expect(parseMiScale2(new Uint8Array(10))).toBeNull();
  });

  it('Base64 をデコードする', () => {
    expect([...base64ToBytes('AAEC/w==')]).toEqual([0, 1, 2, 255]);
  });
});

describe('reduceMeasurement', () => {
  const run = (packets: MiScale2Packet[]) => packets.reduce(reduceMeasurement, INITIAL_MEASUREMENT);

  it('変動中 → 確定 → インピーダンスで完了', () => {
    const measuring = run([packet({ weightRaw: 12000 })]);
    expect(measuring).toEqual({ phase: 'measuring', liveWeightKg: 60 });

    const stable = run([
      packet({ weightRaw: 12000 }),
      packet({ weightRaw: 13060, stabilized: true }),
    ]);
    expect(stable).toMatchObject({ phase: 'stable', result: { weightKg: 65.3, impedance: null } });

    const done = reduceMeasurement(
      stable,
      packet({ weightRaw: 13060, stabilized: true, impedance: 480 })
    );
    expect(done).toMatchObject({ phase: 'done', result: { impedance: 480 } });

    // 同じ計測の後続パケットにインピーダンスがなくても、取れた値は保持する
    const after = reduceMeasurement(
      done,
      packet({ weightRaw: 13060, stabilized: true, loadRemoved: true })
    );
    expect(after).toMatchObject({ phase: 'done', result: { impedance: 480 } });
  });

  it('インピーダンスなしで降りたら体重だけで完了', () => {
    const state = run([
      packet({ weightRaw: 13060, stabilized: true }),
      packet({ weightRaw: 0, loadRemoved: true }),
    ]);
    expect(state).toMatchObject({ phase: 'done', result: { weightKg: 65.3, impedance: null } });
  });

  it('再び乗ると新しい計測になる', () => {
    const state = run([
      packet({ weightRaw: 13060, stabilized: true, impedance: 480 }),
      packet({ weightRaw: 11000, time: [2026, 9, 27, 7, 35, 0] }),
    ]);
    expect(state).toEqual({ phase: 'measuring', liveWeightKg: 55 });
  });
});

describe('recordedAt', () => {
  const now = new Date(2026, 8, 27, 8, 0);
  it('体重計の時計が妥当ならそれを使う', () => {
    const t = new Date(2026, 8, 27, 7, 30);
    expect(recordedAt(t, now)).toBe(t);
  });
  it('時計がずれていれば端末の現在時刻', () => {
    expect(recordedAt(new Date(2000, 0, 1), now)).toBe(now);
    expect(recordedAt(new Date(2026, 8, 28), now)).toBe(now);
  });
});

describe('体組成', () => {
  it('BMI と年齢', () => {
    expect(bmi(70, 175)).toBeCloseTo(22.86, 2);
    expect(ageOn('1990-09-27', new Date(2026, 8, 27))).toBe(36);
    expect(ageOn('1990-09-28', new Date(2026, 8, 27))).toBe(35);
  });

  it('一般的な男性の値がもっともらしい範囲に収まる', () => {
    const c = computeBodyComposition({
      weightKg: 70,
      heightCm: 175,
      age: 30,
      sex: 'male',
      impedance: 500,
    });
    expect(c.bodyFatPct).toBeCloseTo(19.2, 1);
    expect(c.muscleKg).toBeCloseTo(53.7, 1);
    expect(c.waterPct).toBeCloseTo(55.4, 1);
    expect(c.boneKg).toBeCloseTo(2.88, 2);
    expect(c.visceralFat).toBeCloseTo(9.65, 2);
    expect(c.bmrKcal).toBe(1526);
  });

  it('女性でも範囲内に収まる', () => {
    const c = computeBodyComposition({
      weightKg: 52,
      heightCm: 158,
      age: 40,
      sex: 'female',
      impedance: 600,
    });
    expect(c.bodyFatPct).toBeGreaterThan(5);
    expect(c.bodyFatPct).toBeLessThan(45);
    expect(c.muscleKg).toBeGreaterThan(10);
    expect(c.visceralFat).toBeGreaterThanOrEqual(1);
  });
});
