import { initialPlan, nextDraft, shortSet } from '../set-plan';

const prev = [
  { weightKg: 60, reps: 10 },
  { weightKg: 60, reps: 8 },
  { weightKg: 0, reps: 12 },
];

describe('予定のセット', () => {
  it('前回の記録のうち、まだ終えていない分を並べる', () => {
    expect(initialPlan(prev, 0)).toEqual([
      { weight: '60.0', reps: '10' },
      { weight: '60.0', reps: '8' },
      { weight: '', reps: '12' },
    ]);
    expect(initialPlan(prev, 2)).toEqual([{ weight: '', reps: '12' }]);
    expect(initialPlan(prev, 3)).toEqual([]);
  });

  it('前回がなければ空の1セット(記録済みがあれば何も出さない)', () => {
    expect(initialPlan(null, 0)).toEqual([{ weight: '', reps: '' }]);
    expect(initialPlan(null, 1)).toEqual([]);
  });

  it('セット追加は直前と同じ値', () => {
    expect(nextDraft({ weight: '62.5', reps: '8' })).toEqual({ weight: '62.5', reps: '8' });
    expect(nextDraft(undefined)).toEqual({ weight: '', reps: '' });
  });

  it('短い表記', () => {
    expect(shortSet({ weightKg: 62.5, reps: 8 })).toBe('62.5×8');
    expect(shortSet({ weightKg: 0, reps: 12 })).toBe('自重×12');
  });
});
