import { movingAverage, niceTicks, rangeStart, toDailySeries } from '../weight-stats';

const at = (day: number, hour = 7) => new Date(2026, 8, day, hour).getTime();

describe('toDailySeries', () => {
  it('同じ日の計測は平均し、日付昇順に並べる', () => {
    const daily = toDailySeries([
      { measuredAt: at(3), value: 70 },
      { measuredAt: at(1, 7), value: 65 },
      { measuredAt: at(1, 22), value: 66 },
    ]);
    expect(daily.map((d) => [d.date, d.value])).toEqual([
      ['2026-09-01', 65.5],
      ['2026-09-03', 70],
    ]);
    expect(daily[0].time).toBe(new Date(2026, 8, 1).getTime());
  });
});

describe('movingAverage', () => {
  it('当日を含む直近7日間の平均を取る', () => {
    const daily = toDailySeries(
      [1, 2, 3, 4, 5, 6, 7, 8].map((day) => ({ measuredAt: at(day), value: day }))
    );
    const ma = movingAverage(daily);
    expect(ma[0].value).toBe(1);
    expect(ma[6].value).toBe(4); // 1..7
    expect(ma[7].value).toBe(5); // 2..8
  });

  it('記録のない日は分母に含めない', () => {
    const daily = toDailySeries([
      { measuredAt: at(1), value: 60 },
      { measuredAt: at(7), value: 62 },
      { measuredAt: at(8), value: 64 },
    ]);
    const ma = movingAverage(daily);
    expect(ma[1].value).toBe(61); // 1日と7日
    expect(ma[2].value).toBe(63); // 1日は範囲外、7日と8日
  });
});

describe('rangeStart', () => {
  const now = new Date(2026, 8, 26, 15);
  it('当日を含む期間の開始日 0:00 を返す', () => {
    expect(rangeStart('week', now)).toBe(new Date(2026, 8, 20).getTime());
    expect(rangeStart('month', now)).toBe(new Date(2026, 7, 28).getTime());
  });
  it('全期間は null', () => {
    expect(rangeStart('all', now)).toBeNull();
  });
});

describe('niceTicks', () => {
  it('データ範囲を含むきりのよい目盛りを返す', () => {
    expect(niceTicks(64.2, 66.8)).toEqual([64, 65, 66, 67]);
    expect(niceTicks(65.1, 65.9)).toEqual([65, 65.5, 66]);
    expect(niceTicks(60, 75)).toEqual([60, 65, 70, 75]);
  });
  it('値が1つでも幅を持たせる', () => {
    const ticks = niceTicks(65, 65);
    expect(ticks[0]).toBeLessThan(65);
    expect(ticks[ticks.length - 1]).toBeGreaterThan(65);
  });
});
