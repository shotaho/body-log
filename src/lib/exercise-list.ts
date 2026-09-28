import { BODY_PARTS, type BodyPart } from '@/db/migrations';
import type { Exercise } from '@/db/workouts';

export type ExerciseTab = 'all' | BodyPart;

export type ExerciseSection = { key: string; title: string; data: Exercise[] };

/** 一覧の先頭に出す「最近使った種目」の数 */
export const RECENT_LIMIT = 5;

/** ひらがな → カタカナ(検索で「べんち」でも「ベンチ」に当たるように) */
function toKatakana(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

const normalize = (s: string) => toKatakana(s.trim().toLowerCase());

export function matchesQuery(name: string, query: string): boolean {
  const q = normalize(query);
  return q === '' || normalize(name).includes(q);
}

/**
 * 種目一覧のセクションを作る。
 * - 「すべて」タブで検索していなければ、先頭に「最近使った」を出し、その後に部位ごと
 * - 部位タブではその部位だけ(最近使った種目を上に)
 * - 検索中は、該当する種目を部位ごとに出す
 */
export function buildExerciseSections(
  exercises: Exercise[],
  { recentIds, tab, query }: { recentIds: number[]; tab: ExerciseTab; query: string }
): ExerciseSection[] {
  const recentRank = new Map(recentIds.map((id, i) => [id, i]));
  const byRecent = (a: Exercise, b: Exercise) =>
    (recentRank.get(a.id) ?? Infinity) - (recentRank.get(b.id) ?? Infinity);

  const visible = exercises.filter(
    (e) => (tab === 'all' || e.bodyPart === tab) && matchesQuery(e.name, query)
  );

  if (tab !== 'all') {
    return visible.length > 0
      ? [{ key: tab, title: BODY_PARTS[tab], data: [...visible].sort(byRecent) }]
      : [];
  }

  const sections: ExerciseSection[] = [];
  if (query.trim() === '') {
    const recent = recentIds
      .map((id) => visible.find((e) => e.id === id))
      .filter((e): e is Exercise => e != null)
      .slice(0, RECENT_LIMIT);
    if (recent.length > 0) {
      sections.push({ key: 'recent', title: '最近使った種目', data: recent });
    }
  }
  for (const part of Object.keys(BODY_PARTS) as BodyPart[]) {
    const data = visible.filter((e) => e.bodyPart === part);
    if (data.length > 0) {
      sections.push({ key: part, title: BODY_PARTS[part], data });
    }
  }
  return sections;
}
