import { parseBodyRecordForm } from '../body-record-form';

describe('parseBodyRecordForm', () => {
  it('正しい入力を丸めて返す', () => {
    expect(parseBodyRecordForm({ weight: '65.36', bodyFat: '18,2', note: ' 朝 ' })).toEqual({
      ok: true,
      weightKg: 65.4,
      bodyFatPct: 18.2,
      note: '朝',
    });
  });

  it('体脂肪率とメモは省略できる', () => {
    expect(parseBodyRecordForm({ weight: '70', bodyFat: '', note: '' })).toEqual({
      ok: true,
      weightKg: 70,
      bodyFatPct: null,
      note: null,
    });
  });

  it('体重は必須', () => {
    const result = parseBodyRecordForm({ weight: ' ', bodyFat: '', note: '' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.weight).toBe('体重を入力してください');
  });

  it('範囲外・数値以外はエラー', () => {
    const result = parseBodyRecordForm({ weight: '650', bodyFat: 'abc', note: '' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.weight).toContain('範囲');
    expect(!result.ok && result.errors.bodyFat).toBe('数値で入力してください');
  });
});
