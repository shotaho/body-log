import { fireEvent, render, screen } from '@testing-library/react-native';

import { movingAverage, toDailySeries } from '@/lib/weight-stats';

import { TrendChart } from '../trend-chart';

const day = (d: number) => new Date(2026, 8, d, 7).getTime();
const daily = toDailySeries(
  [65.2, 64.8, 65.0, 64.6].map((value, i) => ({ measuredAt: day(20 + i), value }))
);
const average = movingAverage(daily);
const from = new Date(2026, 8, 20).getTime();
const to = new Date(2026, 8, 26).getTime();

async function renderLaidOut() {
  await render(<TrendChart daily={daily} average={average} unit="kg" from={from} to={to} />);
  const plot = screen.getByLabelText('推移グラフ(kg)');
  await fireEvent(plot, 'layout', { nativeEvent: { layout: { width: 320, height: 200 } } });
  return plot;
}

describe('TrendChart', () => {
  it('凡例・軸ラベルを表示する', async () => {
    await renderLaidOut();
    expect(screen.getByText('7日平均')).toBeTruthy();
    expect(screen.getByText('日ごとの値')).toBeTruthy();
    expect(screen.getByText('9/20')).toBeTruthy();
    expect(screen.getByText('9/26')).toBeTruthy();
  });

  it('タッチした位置に最も近い日の値をツールチップに出す', async () => {
    const plot = await renderLaidOut();
    // プロット右端付近 → 最後の計測日(9/23)が選ばれる
    await fireEvent(plot, 'responderGrant', { nativeEvent: { locationX: 300 } });
    // 9/23 は X 軸の中央ラベルにもあるので、ツールチップ分と合わせて2つ
    expect(screen.getAllByText('9/23')).toHaveLength(2);
    expect(screen.getByText('64.6 kg')).toBeTruthy();
    // 7日平均 = (65.2 + 64.8 + 65.0 + 64.6) / 4 = 64.9
    expect(screen.getByText('64.9 kg')).toBeTruthy();
  });
});
