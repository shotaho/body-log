import type { Exercise } from '@/db/workouts';

import { buildExerciseSections, matchesQuery } from '../exercise-list';

const ex = (id: number, name: string, bodyPart: Exercise['bodyPart']): Exercise => ({
  id,
  name,
  bodyPart,
  isPreset: true,
});

const exercises = [
  ex(1, 'ベンチプレス', 'chest'),
  ex(2, 'チェストプレス(マシン)', 'chest'),
  ex(3, 'スクワット', 'legs'),
  ex(4, 'レッグエクステンション', 'legs'),
  ex(5, 'ラットプルダウン', 'back'),
];

describe('matchesQuery', () => {
  it('部分一致・ひらがなでも一致', () => {
    expect(matchesQuery('ベンチプレス', 'ベンチ')).toBe(true);
    expect(matchesQuery('ベンチプレス', 'べんち')).toBe(true);
    expect(matchesQuery('チェストプレス(マシン)', 'ましん')).toBe(true);
    expect(matchesQuery('スクワット', 'ベンチ')).toBe(false);
    expect(matchesQuery('スクワット', '  ')).toBe(true);
  });
});

describe('buildExerciseSections', () => {
  it('すべて: 最近使った種目 → 部位ごと', () => {
    const sections = buildExerciseSections(exercises, { recentIds: [4, 1], tab: 'all', query: '' });
    expect(sections.map((s) => [s.title, s.data.map((e) => e.id)])).toEqual([
      ['最近使った種目', [4, 1]],
      ['胸', [1, 2]],
      ['背中', [5]],
      ['脚', [3, 4]],
    ]);
  });

  it('部位タブ: その部位だけ、最近使った順を上に', () => {
    const sections = buildExerciseSections(exercises, { recentIds: [4], tab: 'legs', query: '' });
    expect(sections.map((s) => [s.title, s.data.map((e) => e.id)])).toEqual([['脚', [4, 3]]]);
  });

  it('検索中は「最近使った」を出さず、該当する種目だけ', () => {
    const sections = buildExerciseSections(exercises, {
      recentIds: [4, 1],
      tab: 'all',
      query: 'プレス',
    });
    expect(sections.map((s) => [s.title, s.data.map((e) => e.id)])).toEqual([['胸', [1, 2]]]);
  });

  it('該当なしなら空', () => {
    expect(buildExerciseSections(exercises, { recentIds: [], tab: 'abs', query: '' })).toEqual([]);
  });
});
