import { addMonths, monthGrid } from '../calendar';

describe('monthGrid', () => {
  it('日曜始まりで週ごとに並べ、月の外は null', () => {
    // 2026年9月1日は火曜日、30日は水曜日
    const weeks = monthGrid(2026, 8);
    expect(weeks).toHaveLength(5);
    expect(weeks[0].slice(0, 2)).toEqual([null, null]);
    expect(weeks[0][2]).toEqual(new Date(2026, 8, 1));
    expect(weeks[4][3]).toEqual(new Date(2026, 8, 30));
    expect(weeks[4].slice(4)).toEqual([null, null, null]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });

  it('日曜始まりの月は先頭が空かない', () => {
    // 2026年2月1日は日曜日
    expect(monthGrid(2026, 1)[0][0]).toEqual(new Date(2026, 1, 1));
  });
});

describe('addMonths', () => {
  it('年をまたいで移動する', () => {
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});
