import { BODY_PARTS, type BodyPart } from '@/db/migrations';
import { totalVolume, type SetValues } from '@/lib/workout-stats';

export const BODY_PART_KEYS = Object.keys(BODY_PARTS) as BodyPart[];

/** 部位ごとの総ボリューム(重量×回数の合計)。自重のみの部位は回数を 1kg 相当として数える。 */
export function volumeByBodyPart(
  sets: (SetValues & { bodyPart: BodyPart })[]
): Record<BodyPart, number> {
  const result = Object.fromEntries(BODY_PART_KEYS.map((p) => [p, 0])) as Record<BodyPart, number>;
  for (const s of sets) {
    // 自重(0kg)の種目も「鍛えた」ことが分かるよう、重量 0 は 1kg として数える
    result[s.bodyPart] += totalVolume([
      { weightKg: s.weightKg > 0 ? s.weightKg : 1, reps: s.reps },
    ]);
  }
  return result;
}

/** 塗りの段階数(0 = 塗らない, 1〜SHADE_LEVELS) */
export const SHADE_LEVELS = 4;

/**
 * ボリュームを塗りの段階(0〜4)にする。その日の最大の部位が 4。
 * 少しでも行った部位は最低 1 にする(やったことが見えるように)。
 */
export function shadeLevel(volume: number, maxVolume: number): number {
  if (volume <= 0 || maxVolume <= 0) {
    return 0;
  }
  return Math.max(1, Math.ceil((volume / maxVolume) * SHADE_LEVELS));
}
