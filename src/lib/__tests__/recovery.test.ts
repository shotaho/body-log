import {
  assumedTrainingTime,
  fatigueLevel,
  recoveryByBodyPart,
  recoveryOf,
} from '../recovery';

const HOUR = 3_600_000;

describe('回復状態', () => {
  it('経過時間に応じて回復度と残り時間を出す', () => {
    expect(recoveryOf('chest', 0, 12 * HOUR)).toEqual({
      lastTrainedAt: 0,
      percent: 25,
      hoursLeft: 36,
    });
    expect(recoveryOf('legs', 0, 80 * HOUR)).toMatchObject({ percent: 100, hoursLeft: 0 });
    expect(recoveryOf('abs', null, 0)).toMatchObject({ percent: 100, hoursLeft: 0 });
  });

  it('記録のない部位は回復済み', () => {
    const r = recoveryByBodyPart({ back: 0 }, 36 * HOUR);
    expect(r.back.percent).toBe(50);
    expect(r.chest.percent).toBe(100);
  });

  it('疲労が大きいほど濃く塗る', () => {
    expect(fatigueLevel(0)).toBe(4);
    expect(fatigueLevel(30)).toBe(3);
    expect(fatigueLevel(60)).toBe(2);
    expect(fatigueLevel(99)).toBe(1);
    expect(fatigueLevel(100)).toBe(0);
  });

  it('時刻のないワークアウトはその日の正午', () => {
    expect(new Date(assumedTrainingTime('2026-09-28')).getHours()).toBe(12);
  });
});
