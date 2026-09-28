import { fireEvent, render, screen } from '@testing-library/react-native';

import type { WorkoutSet } from '@/db/workouts';

import { ExerciseBlock } from '../exercise-block';

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

async function renderBlock(props: Partial<Parameters<typeof ExerciseBlock>[0]> = {}) {
  const handlers = { onAdd: jest.fn(), onUpdate: jest.fn(), onDelete: jest.fn() };
  await render(
    <ExerciseBlock
      name="ベンチプレス"
      sets={[]}
      previous={previous}
      prSetIds={new Set()}
      onOpenHistory={jest.fn()}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

const press = (label: string) => fireEvent.press(screen.getByLabelText(label));
/** 入力欄に表示している値(未入力ならプレースホルダ) */
const shown = (label: string) => screen.getByLabelText(label).props.accessibilityValue.text;

describe('ExerciseBlock', () => {
  it('前回の記録を表示し、「前回と同じ」で前回のセットをコピーとして追加する', async () => {
    const { onAdd } = await renderBlock();
    expect(screen.getByText(/前回 9\/20/)).toHaveTextContent(
      '前回 9/20: 60.0 kg × 10, 60.0 kg × 8'
    );
    await fireEvent.press(screen.getByText('前回と同じ'));
    expect(onAdd).toHaveBeenCalledWith(previous.sets, { copied: true });
  });

  it('入力欄は前回の1セット目で埋まっており、そのまま追加できる', async () => {
    const { onAdd } = await renderBlock();
    expect(shown('重量')).toBe('60.0');
    expect(shown('回数')).toBe('10');
    await fireEvent.press(screen.getByText('追加'));
    expect(onAdd).toHaveBeenCalledWith([{ weightKg: 60, reps: 10 }], { copied: false });
  });

  it('テンキーで1文字目から入力でき、選んだ直後のキーは値を置き換える', async () => {
    const { onAdd } = await renderBlock();
    await press('重量');
    for (const key of ['7', '2', '小数点', '5']) {
      await press(key);
    }
    expect(shown('重量')).toBe('72.5');
    await press('回数');
    await press('8');
    expect(shown('回数')).toBe('8');
    await fireEvent.press(screen.getByText('追加'));
    expect(onAdd).toHaveBeenCalledWith([{ weightKg: 72.5, reps: 8 }], { copied: false });
  });

  it('±5kg / ±2.5kg ボタンは重量のときだけ出る', async () => {
    await renderBlock();
    await press('重量');
    await press('+5kg');
    await press('+2.5kg');
    expect(shown('重量')).toBe('67.5');
    await press('−5kg');
    expect(shown('重量')).toBe('62.5');
    await press('回数');
    expect(screen.queryByLabelText('+5kg')).toBeNull();
    // 回数では小数点キーを押しても入らない
    await press('1');
    await press('小数点');
    expect(shown('回数')).toBe('1');
  });

  it('不正な回数はエラーを出して追加しない', async () => {
    const { onAdd } = await renderBlock({ previous: null });
    await press('重量');
    await press('5');
    await press('回数');
    await press('0');
    await fireEvent.press(screen.getByText('追加'));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText(/回数は 1〜999/)).toBeTruthy();
  });

  it('セットをタップすると編集でき、PR バッジとセット・レスト時間を表示する', async () => {
    const { onUpdate } = await renderBlock({
      sets: [set(1, 62.5, 5)],
      prSetIds: new Set([1]),
      timings: new Map([[1, { restSeconds: 90, setSeconds: 45 }]]),
    });
    expect(screen.getByText('PR')).toBeTruthy();
    expect(screen.getByText('レスト 1:30 · セット 0:45')).toBeTruthy();
    // 追加済みのセットがあるので「前回と同じ」は出さない
    expect(screen.queryByText('前回と同じ')).toBeNull();

    await fireEvent.press(screen.getByText('62.5 kg × 5'));
    await press('回数');
    await press('6');
    await fireEvent.press(screen.getByText('更新'));
    expect(onUpdate).toHaveBeenCalledWith(1, { weightKg: 62.5, reps: 6 });
  });
});
