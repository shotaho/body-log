import { fireEvent, render, screen } from '@testing-library/react-native';

import type { WorkoutSet } from '@/db/workouts';

import { ExerciseCard } from '../exercise-card';

const set = (id: number, weightKg: number, reps: number): WorkoutSet => ({
  id,
  workoutId: 1,
  exerciseId: 1,
  setOrder: id,
  weightKg,
  reps,
  startedAt: null,
  completedAt: null,
});

const previous = { date: '2026-09-20', sets: [set(10, 60, 10), set(11, 60, 8)] };

async function renderCard(props: Partial<Parameters<typeof ExerciseCard>[0]> = {}) {
  const handlers = {
    onComplete: jest.fn(),
    onUpdate: jest.fn(),
    onDelete: jest.fn(),
    onToggle: jest.fn(),
  };
  await render(
    <ExerciseCard
      name="ベンチプレス"
      sets={[]}
      previous={previous}
      prSetIds={new Set()}
      expanded
      onOpenHistory={jest.fn()}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

const press = (label: string) => fireEvent.press(screen.getByLabelText(label));
/** 欄に表示している値(未入力ならプレースホルダ) */
const shown = (label: string) => screen.getByLabelText(label).props.accessibilityValue.text;

describe('ExerciseCard', () => {
  it('前回の記録と同じ値で予定のセットを並べ、チェックで記録する', async () => {
    const { onComplete } = await renderCard();
    expect(shown('1セット目の重量')).toBe('60.0');
    expect(shown('2セット目の回数')).toBe('8');
    await press('1セット目を完了');
    expect(onComplete).toHaveBeenCalledWith({ weightKg: 60, reps: 10 });
    // 完了した行は予定から消える(記録済みのセットとして親から渡される)
    expect(screen.queryByLabelText('2セット目を完了')).toBeNull();
    expect(screen.getByLabelText('1セット目を完了')).toBeTruthy();
  });

  it('閉じているときは前回の記録だけ出し、タップで開く', async () => {
    const { onToggle } = await renderCard({ expanded: false });
    expect(screen.getByText('前回 9/20: 60.0×10, 60.0×8')).toBeTruthy();
    expect(screen.queryByLabelText('1セット目を完了')).toBeNull();
    await fireEvent.press(screen.getByText('ベンチプレス'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('テンキーで1文字目から入力でき、選んだ直後のキーは値を置き換える', async () => {
    const { onComplete } = await renderCard();
    await press('1セット目の重量');
    for (const key of ['7', '2', '小数点', '5']) {
      await press(key);
    }
    expect(shown('1セット目の重量')).toBe('72.5');
    await press('1セット目の回数');
    await press('8');
    expect(shown('1セット目の回数')).toBe('8');
    await press('1セット目を完了');
    expect(onComplete).toHaveBeenCalledWith({ weightKg: 72.5, reps: 8 });
  });

  it('±5kg / ±2.5kg ボタンは重量のときだけ出る', async () => {
    await renderCard();
    await press('1セット目の重量');
    await press('+5kg');
    await press('+2.5kg');
    expect(shown('1セット目の重量')).toBe('67.5');
    await press('−5kg');
    expect(shown('1セット目の重量')).toBe('62.5');
    await press('1セット目の回数');
    expect(screen.queryByLabelText('+5kg')).toBeNull();
    // 回数では小数点キーを押しても入らない
    await press('1');
    await press('小数点');
    expect(shown('1セット目の回数')).toBe('1');
  });

  it('セットの追加・削除(追加は直前と同じ値)', async () => {
    await renderCard();
    await fireEvent.press(screen.getByText('セット追加'));
    expect(shown('3セット目の重量')).toBe('60.0');
    expect(shown('3セット目の回数')).toBe('8');
    await fireEvent.press(screen.getByText('セット削除'));
    await fireEvent.press(screen.getByText('セット削除'));
    expect(screen.queryByLabelText('2セット目を完了')).toBeNull();
  });

  it('回数が空のままチェックするとエラーを出して記録しない', async () => {
    const { onComplete } = await renderCard({ previous: null });
    await press('1セット目を完了');
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByText(/回数/)).toBeTruthy();
  });

  it('完了したセットは PR・時間を表示し、値を直すと更新、チェックを外すと削除する', async () => {
    const { onUpdate, onDelete } = await renderCard({
      sets: [set(1, 62.5, 5)],
      prSetIds: new Set([1]),
      timings: new Map([[1, { restSeconds: 90, setSeconds: 45 }]]),
    });
    expect(screen.getByText('PR')).toBeTruthy();
    expect(screen.getByText('レスト 1:30 · セット 0:45')).toBeTruthy();
    // 前回の2セット目だけが予定として残る
    expect(shown('2セット目の回数')).toBe('8');

    await press('1セット目の回数');
    await press('6');
    await press('テンキーを閉じる');
    expect(onUpdate).toHaveBeenCalledWith(1, { weightKg: 62.5, reps: 6 });

    await press('1セット目の完了を取り消す');
    expect(onDelete).toHaveBeenCalledWith(1);
  });
});
