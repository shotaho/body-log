import { formatDateJa, startOfWeek, toLocalDateString } from '../date';

describe('toLocalDateString', () => {
  it('ゼロ埋めした YYYY-MM-DD を返す', () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('startOfWeek', () => {
  it('月曜始まりで週の初日を返す', () => {
    // 2026-09-26 は土曜日
    expect(toLocalDateString(startOfWeek(new Date(2026, 8, 26, 12)))).toBe('2026-09-21');
    // 月曜日はその日
    expect(toLocalDateString(startOfWeek(new Date(2026, 8, 21, 0)))).toBe('2026-09-21');
    // 日曜日は前の週の月曜
    expect(toLocalDateString(startOfWeek(new Date(2026, 8, 27, 23)))).toBe('2026-09-21');
  });

  it('時刻は 0:00 になる', () => {
    expect(startOfWeek(new Date(2026, 8, 26, 12, 34)).getHours()).toBe(0);
  });
});

describe('formatDateJa', () => {
  it('月日と曜日を表示する', () => {
    expect(formatDateJa(new Date(2026, 8, 26))).toBe('9月26日(土)');
  });
});
