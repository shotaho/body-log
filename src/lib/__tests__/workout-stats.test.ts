import {
  bestOf,
  estimate1rm,
  formatSet,
  parseSetForm,
  personalRecordSetIds,
  sessionSeries,
  totalVolume,
} from '../workout-stats';

describe('estimate1rm', () => {
  it('Epley 式で推定する', () => {
    expect(estimate1rm({ weightKg: 60, reps: 10 })).toBe(80);
  });
  it('1回なら重量そのもの、自重は 0', () => {
    expect(estimate1rm({ weightKg: 100, reps: 1 })).toBe(100);
    expect(estimate1rm({ weightKg: 0, reps: 10 })).toBe(0);
  });
});

describe('totalVolume / bestOf', () => {
  const sets = [
    { weightKg: 60, reps: 10 },
    { weightKg: 70, reps: 5 },
  ];
  it('ボリュームは重量×回数の合計', () => {
    expect(totalVolume(sets)).toBe(950);
  });
  it('最大重量と最大推定1RM', () => {
    // 60×10 → 80、70×5 → 81.7
    expect(bestOf(sets)?.weightKg).toBe(70);
    expect(bestOf(sets)?.e1rm).toBeCloseTo(81.67, 2);
    expect(bestOf([])).toBeNull();
  });
});

describe('personalRecordSetIds', () => {
  const prior = { weightKg: 60, e1rm: 80 };

  it('最大重量または推定1RMを上回ったセットが PR', () => {
    const ids = personalRecordSetIds(prior, [
      { id: 1, weightKg: 60, reps: 10 }, // 同じ → PR ではない
      { id: 2, weightKg: 62.5, reps: 3 }, // 重量更新
      { id: 3, weightKg: 55, reps: 20 }, // 推定1RM 91.7 で更新
      { id: 4, weightKg: 62.5, reps: 3 }, // 同じワークアウト内の id 2 と同じ → PR ではない
    ]);
    expect([...ids]).toEqual([2, 3]);
  });

  it('過去の記録がなければ PR にしない', () => {
    expect(personalRecordSetIds(null, [{ id: 1, weightKg: 100, reps: 1 }]).size).toBe(0);
  });
});

describe('parseSetForm', () => {
  it('重量と回数を検証して返す', () => {
    expect(parseSetForm('62,5', '8')).toEqual({ ok: true, weightKg: 62.5, reps: 8 });
  });
  it('重量は空なら自重(0kg)', () => {
    expect(parseSetForm('', '12')).toEqual({ ok: true, weightKg: 0, reps: 12 });
  });
  it('回数は1以上の整数', () => {
    expect(parseSetForm('60', '0').ok).toBe(false);
    expect(parseSetForm('60', '8.5').ok).toBe(false);
    expect(parseSetForm('60', '').ok).toBe(false);
  });
  it('重量の範囲外・数値以外はエラー', () => {
    expect(parseSetForm('-5', '10').ok).toBe(false);
    expect(parseSetForm('abc', '10').ok).toBe(false);
  });
});

describe('formatSet', () => {
  it('自重は「自重」と表示する', () => {
    const f = (n: number) => n.toFixed(1);
    expect(formatSet({ weightKg: 60, reps: 10 }, f)).toBe('60.0 kg × 10');
    expect(formatSet({ weightKg: 0, reps: 10 }, f)).toBe('自重 × 10');
  });
});

describe('sessionSeries', () => {
  it('日ごとに最大重量・推定1RM・ボリュームを集計する', () => {
    const series = sessionSeries([
      { date: '2026-09-22', weightKg: 60, reps: 10 },
      { date: '2026-09-20', weightKg: 50, reps: 10 },
      { date: '2026-09-22', weightKg: 70, reps: 5 },
    ]);
    expect(series.maxWeight.map((p) => [p.date, p.value])).toEqual([
      ['2026-09-20', 50],
      ['2026-09-22', 70],
    ]);
    expect(series.e1rm[1].value).toBeCloseTo(81.67, 2);
    expect(series.volume[1].value).toBe(950);
    expect(series.volume[0].time).toBe(new Date(2026, 8, 20).getTime());
  });
});
