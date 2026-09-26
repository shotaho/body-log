import { format1, parse1, round1 } from '../decimal';

describe('round1', () => {
  it('小数点第1位に四捨五入する', () => {
    expect(round1(65.34)).toBe(65.3);
    expect(round1(65.35)).toBe(65.4);
    expect(round1(1.05)).toBe(1.1);
    expect(round1(70)).toBe(70);
  });
});

describe('format1', () => {
  it('常に小数点第1位まで表示する', () => {
    expect(format1(65)).toBe('65.0');
    expect(format1(65.26)).toBe('65.3');
  });
});

describe('parse1', () => {
  it('半角・全角・カンマ区切りを受け付ける', () => {
    expect(parse1('65.3')).toBe(65.3);
    expect(parse1('65,3')).toBe(65.3);
    expect(parse1('\uFF16\uFF15\uFF0E\uFF13')).toBe(65.3); // 全角「65.3」
    expect(parse1(' 80 ')).toBe(80);
    expect(parse1('.5')).toBe(0.5);
    expect(parse1('62.')).toBe(62);
  });

  it('第2位以下は丸める', () => {
    expect(parse1('65.36')).toBe(65.4);
  });

  it('数値でなければ null', () => {
    expect(parse1('')).toBeNull();
    expect(parse1('abc')).toBeNull();
    expect(parse1('6.5.3')).toBeNull();
    expect(parse1('.')).toBeNull();
  });
});
