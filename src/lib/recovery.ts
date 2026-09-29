import type { BodyPart } from '@/db/migrations';
import { BODY_PART_KEYS, SHADE_LEVELS } from '@/lib/body-map';

/**
 * 部位ごとの回復状態。最後に鍛えてからの経過時間で決める(目安。ボリュームは考慮しない)。
 * 大きい筋肉(背中・脚)は長め、腹は短め。
 */
export const RECOVERY_HOURS: Record<BodyPart, number> = {
  chest: 48,
  back: 72,
  legs: 72,
  shoulders: 48,
  arms: 48,
  abs: 24,
  other: 48,
};

export type Recovery = {
  /** 最後に鍛えた時刻(記録がなければ null) */
  lastTrainedAt: number | null;
  /** 回復度 0〜100(%)。記録がなければ 100 */
  percent: number;
  /** 回復までの残り時間(時間、切り上げ)。回復済みなら 0 */
  hoursLeft: number;
};

export function recoveryOf(part: BodyPart, lastTrainedAt: number | null, now: number): Recovery {
  if (lastTrainedAt == null) {
    return { lastTrainedAt, percent: 100, hoursLeft: 0 };
  }
  const total = RECOVERY_HOURS[part];
  const elapsed = Math.max(0, (now - lastTrainedAt) / 3_600_000);
  return {
    lastTrainedAt,
    percent: Math.min(100, Math.floor((elapsed / total) * 100)),
    hoursLeft: Math.max(0, Math.ceil(total - elapsed)),
  };
}

export function recoveryByBodyPart(
  lastTrained: Partial<Record<BodyPart, number>>,
  now: number
): Record<BodyPart, Recovery> {
  return Object.fromEntries(
    BODY_PART_KEYS.map((p) => [p, recoveryOf(p, lastTrained[p] ?? null, now)])
  ) as Record<BodyPart, Recovery>;
}

/** 全身イラストの塗り(疲労が大きいほど濃い)。回復済みは 0。 */
export function fatigueLevel(percent: number): number {
  if (percent >= 100) {
    return 0;
  }
  return Math.min(SHADE_LEVELS, Math.floor(((100 - percent) / 100) * SHADE_LEVELS) + 1);
}

/** ワークアウトの時刻が記録されていない(過去日の後入力など)ときは、その日の正午に行ったとみなす */
export function assumedTrainingTime(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
}
