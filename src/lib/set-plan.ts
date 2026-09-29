import { format1 } from '@/lib/decimal';
import type { SetValues } from '@/lib/workout-stats';

/** 入力中のセットの値(テンキーで編集する文字列) */
export type SetDraft = { weight: string; reps: string };

export const EMPTY_DRAFT: SetDraft = { weight: '', reps: '' };

export function toDraft(s: SetValues): SetDraft {
  return { weight: s.weightKg > 0 ? format1(s.weightKg) : '', reps: String(s.reps) };
}

/**
 * 最初に並べておく予定のセット。
 * 前回の記録があれば、まだ終えていない分を前回と同じ値で並べる。なければ空の1セット。
 */
export function initialPlan(previous: SetValues[] | null, doneCount: number): SetDraft[] {
  if (previous && previous.length > doneCount) {
    return previous.slice(doneCount).map(toDraft);
  }
  return doneCount === 0 ? [EMPTY_DRAFT] : [];
}

/** 「セット追加」で足すセット。直前のセットと同じ値にする */
export function nextDraft(last: SetDraft | undefined): SetDraft {
  return last ? { ...last } : EMPTY_DRAFT;
}

/** 表の「前回」欄などに使う短い表記 */
export function shortSet({ weightKg, reps }: SetValues): string {
  return `${weightKg > 0 ? format1(weightKg) : '自重'}×${reps}`;
}
