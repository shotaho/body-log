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
});
