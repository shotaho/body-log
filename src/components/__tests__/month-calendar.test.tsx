import { fireEvent, render, screen } from '@testing-library/react-native';

import { MonthCalendar } from '../month-calendar';

describe('MonthCalendar', () => {
  it('記録のある日に印を付け、日付と月の切り替えを通知する', async () => {
    const onSelect = jest.fn();
    const onChangeMonth = jest.fn();
    await render(
      <MonthCalendar
        year={2026}
        month={8}
        workoutDates={new Set(['2026-09-20'])}
        weighDates={new Set(['2026-09-20', '2026-09-22'])}
        today="2026-09-27"
        selected="2026-09-27"
        onSelect={onSelect}
        onChangeMonth={onChangeMonth}
      />
    );

    expect(screen.getByText('2026年9月')).toBeTruthy();
    expect(screen.getByLabelText('9月20日 トレーニング・体重記録あり')).toBeTruthy();
    expect(screen.getByLabelText('9月22日 体重記録あり')).toBeTruthy();
    expect(screen.getByLabelText('9月21日')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('9月22日 体重記録あり'));
    expect(onSelect).toHaveBeenCalledWith('2026-09-22');

    await fireEvent.press(screen.getByLabelText('次の月'));
    expect(onChangeMonth).toHaveBeenCalledWith(1);
  });

  it('同じ日を素早く2回タップするとダブルタップを通知する', async () => {
    const onSelect = jest.fn();
    const onDoubleSelect = jest.fn();
    await render(
      <MonthCalendar
        year={2026}
        month={8}
        workoutDates={new Set()}
        weighDates={new Set()}
        today="2026-09-27"
        selected="2026-09-27"
        onSelect={onSelect}
        onDoubleSelect={onDoubleSelect}
        onChangeMonth={jest.fn()}
      />
    );
    const tap = async (label: string, at: number) => {
      await fireEvent.press(screen.getByLabelText(label), { nativeEvent: { timestamp: at } });
    };

    await tap('9月20日', 1_000);
    await tap('9月20日', 1_300);
    expect(onDoubleSelect).toHaveBeenCalledWith('2026-09-20');
    expect(onDoubleSelect).toHaveBeenCalledTimes(1);

    // 間が空いた・別の日なら通知しない
    await tap('9月21日', 5_000);
    await tap('9月21日', 6_000);
    await tap('9月22日', 6_100);
    expect(onDoubleSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(5);
  });
});
