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

describe('ExerciseBlock', () => {
  it('前回の記録を表示し、「前回と同じ」で前回のセットを追加する', async () => {
    const { onAdd } = await renderBlock();
    expect(screen.getByText(/前回 9\/20/)).toHaveTextContent(
      '前回 9/20: 60.0 kg × 10, 60.0 kg × 8'
    );
    await fireEvent.press(screen.getByText('前回と同じ'));
    expect(onAdd).toHaveBeenCalledWith(previous.sets);
  });

  it('入力欄は前回の1セット目で埋まっており、そのまま追加できる', async () => {
    const { onAdd } = await renderBlock();
    expect(screen.getByLabelText('重量')).toHaveDisplayValue('60.0');
    expect(screen.getByLabelText('回数')).toHaveDisplayValue('10');
    await fireEvent.press(screen.getByText('追加'));
    expect(onAdd).toHaveBeenCalledWith([{ weightKg: 60, reps: 10 }]);
  });

  it('不正な回数はエラーを出して追加しない', async () => {
    const { onAdd } = await renderBlock({ previous: null });
    await fireEvent.changeText(screen.getByLabelText('重量'), '50');
    await fireEvent.changeText(screen.getByLabelText('回数'), '0');
    await fireEvent.press(screen.getByText('追加'));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText(/回数は 1〜999/)).toBeTruthy();
  });

  it('セットをタップすると編集でき、PR バッジを表示する', async () => {
    const { onUpdate } = await renderBlock({ sets: [set(1, 62.5, 5)], prSetIds: new Set([1]) });
    expect(screen.getByText('PR')).toBeTruthy();
    // 追加済みのセットがあるので「前回と同じ」は出さない
    expect(screen.queryByText('前回と同じ')).toBeNull();

    await fireEvent.press(screen.getByText('62.5 kg × 5'));
    await fireEvent.changeText(screen.getByLabelText('回数'), '6');
    await fireEvent.press(screen.getByText('更新'));
    expect(onUpdate).toHaveBeenCalledWith(1, { weightKg: 62.5, reps: 6 });
  });
});
