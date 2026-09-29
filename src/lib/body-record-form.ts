import { parse1 } from '@/lib/decimal';

export const WEIGHT_RANGE = { min: 20, max: 300 } as const;
export const BODY_FAT_RANGE = { min: 1, max: 75 } as const;

export type BodyRecordFormValues = { weight: string; bodyFat: string; note: string };

export type BodyRecordFormResult =
  | { ok: true; weightKg: number; bodyFatPct: number | null; note: string | null }
  | { ok: false; errors: { weight?: string; bodyFat?: string } };

/** 体重記録フォームの入力を検証し、保存用の値(小数点第1位に丸め済み)に変換する。 */
export function parseBodyRecordForm(values: BodyRecordFormValues): BodyRecordFormResult {
  const errors: { weight?: string; bodyFat?: string } = {};

  const weightKg = parse1(values.weight);
  if (values.weight.trim() === '') {
    errors.weight = '体重を入力してください';
  } else if (weightKg == null) {
    errors.weight = '数値で入力してください';
  } else if (weightKg < WEIGHT_RANGE.min || weightKg > WEIGHT_RANGE.max) {
    errors.weight = `${WEIGHT_RANGE.min}〜${WEIGHT_RANGE.max} kg の範囲で入力してください`;
  }

  let bodyFatPct: number | null = null;
  if (values.bodyFat.trim() !== '') {
    bodyFatPct = parse1(values.bodyFat);
    if (bodyFatPct == null) {
      errors.bodyFat = '数値で入力してください';
    } else if (bodyFatPct < BODY_FAT_RANGE.min || bodyFatPct > BODY_FAT_RANGE.max) {
      errors.bodyFat = `${BODY_FAT_RANGE.min}〜${BODY_FAT_RANGE.max} % の範囲で入力してください`;
    }
  }

  if (errors.weight || errors.bodyFat) {
    return { ok: false, errors };
  }
  const note = values.note.trim();
  return { ok: true, weightKg: weightKg!, bodyFatPct, note: note === '' ? null : note };
}
