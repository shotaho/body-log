import { fromLocalDateString } from '@/lib/date';
import { parse1, round1 } from '@/lib/decimal';
import type { DailyPoint } from '@/lib/weight-stats';

export type SetValues = { weightKg: number; reps: number };

/**
 * 推定1RM(Epley 式: 重量 × (1 + 回数 / 30))。1回なら重量そのもの。
 * 自重(0kg)や 0 回は 0。
 */
export function estimate1rm({ weightKg, reps }: SetValues): number {
  if (weightKg <= 0 || reps <= 0) {
    return 0;
  }
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

/** ボリューム(重量 × 回数 の合計)。 */
export function totalVolume(sets: SetValues[]): number {
  return sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);
}

export type Best = { weightKg: number; e1rm: number };

/** セット群の最大重量と最大推定1RM。セットがなければ null。 */
export function bestOf(sets: SetValues[]): Best | null {
  if (sets.length === 0) {
    return null;
  }
  return {
    weightKg: Math.max(...sets.map((s) => s.weightKg)),
    e1rm: Math.max(...sets.map(estimate1rm)),
  };
}

/**
 * 自己ベスト(PR)を更新したセットの id を返す。
 * それまでの最大重量または最大推定1RMを(小数点第1位で比べて)上回ったセットが PR。
 * 同じワークアウト内の前のセットも「それまで」に含める。
 * 過去の記録がない(priorBest が null の)初回は比較対象がないので PR にしない。
 */
export function personalRecordSetIds<T extends SetValues & { id: number }>(
  priorBest: Best | null,
  setsInOrder: T[]
): Set<number> {
  const ids = new Set<number>();
  if (!priorBest) {
    return ids;
  }
  let best = priorBest;
  for (const s of setsInOrder) {
    const e1rm = estimate1rm(s);
    if (round1(s.weightKg) > round1(best.weightKg) || round1(e1rm) > round1(best.e1rm)) {
      ids.add(s.id);
    }
    best = { weightKg: Math.max(best.weightKg, s.weightKg), e1rm: Math.max(best.e1rm, e1rm) };
  }
  return ids;
}

export const SET_WEIGHT_MAX = 1000;
export const SET_REPS_MAX = 999;

export type SetFormResult =
  | { ok: true; weightKg: number; reps: number }
  | { ok: false; error: string };

/** セット入力(重量・回数)の検証。重量 0 は自重として許可する。 */
export function parseSetForm(weight: string, reps: string): SetFormResult {
  const weightKg = weight.trim() === '' ? 0 : parse1(weight);
  if (weightKg == null || weightKg < 0 || weightKg > SET_WEIGHT_MAX) {
    return { ok: false, error: `重量は 0〜${SET_WEIGHT_MAX} kg で入力してください` };
  }
  const repsValue = parse1(reps);
  if (
    repsValue == null ||
    !Number.isInteger(repsValue) ||
    repsValue < 1 ||
    repsValue > SET_REPS_MAX
  ) {
    return { ok: false, error: `回数は 1〜${SET_REPS_MAX} の整数で入力してください` };
  }
  return { ok: true, weightKg, reps: repsValue };
}

/** 表示用: '60.0 kg × 10' / 自重なら '自重 × 10' */
export function formatSet({ weightKg, reps }: SetValues, format: (n: number) => string): string {
  return weightKg > 0 ? `${format(weightKg)} kg × ${reps}` : `自重 × ${reps}`;
}

export type SessionMetric = 'maxWeight' | 'e1rm' | 'volume';

/** 種目の履歴(日付つきセット)を日ごとに集計し、指標ごとの推移にする。日付昇順。 */
export function sessionSeries(
  history: (SetValues & { date: string })[]
): Record<SessionMetric, DailyPoint[]> {
  const byDate = new Map<string, SetValues[]>();
  for (const s of history) {
    byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  }
  const dates = [...byDate.keys()].sort();
  const point = (date: string, value: number): DailyPoint => ({
    date,
    time: fromLocalDateString(date).getTime(),
    value,
  });
  return {
    maxWeight: dates.map((d) => point(d, bestOf(byDate.get(d)!)!.weightKg)),
    e1rm: dates.map((d) => point(d, bestOf(byDate.get(d)!)!.e1rm)),
    volume: dates.map((d) => point(d, totalVolume(byDate.get(d)!))),
  };
}
