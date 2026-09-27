import type { ScaleRecordInput } from '@/db/body-records';
import type { Profile } from '@/db/profile';
import { ageOn, bmi, computeBodyComposition } from '@/lib/scale/body-composition';
import { recordedAt, type MeasurementResult } from '@/lib/scale/measurement';

/**
 * 計測結果を保存用の値にする。
 * BMI は身長があれば、体組成はインピーダンスとプロフィール(身長・生年月日・性別)がそろえば計算する。
 */
export function toScaleRecord(
  result: MeasurementResult,
  deviceId: string,
  profile: Profile,
  now: Date
): ScaleRecordInput {
  const { weightKg, impedance } = result;
  const composition =
    impedance != null && profile.heightCm != null && profile.birthDate && profile.sex
      ? computeBodyComposition({
          weightKg,
          heightCm: profile.heightCm,
          age: ageOn(profile.birthDate, now),
          sex: profile.sex,
          impedance,
        })
      : null;

  return {
    scaleKey: `${deviceId}|${result.key}`,
    measuredAt: recordedAt(result.measuredAt, now).getTime(),
    weightKg,
    impedance,
    bmi: profile.heightCm != null ? bmi(weightKg, profile.heightCm) : null,
    bodyFatPct: composition?.bodyFatPct ?? null,
    muscleKg: composition?.muscleKg ?? null,
    waterPct: composition?.waterPct ?? null,
    boneKg: composition?.boneKg ?? null,
    visceralFat: composition?.visceralFat ?? null,
    bmrKcal: composition?.bmrKcal ?? null,
  };
}
