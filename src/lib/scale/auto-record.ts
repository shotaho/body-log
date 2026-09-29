/**
 * アプリを開いている間に体重計に乗ったら自動で記録する。
 * 子どもや荷物が乗ったときに記録しないよう、下限未満の体重は記録しない。
 */

export const AUTO_RECORD_SETTING_KEY = 'auto_record_min_kg';
export const DEFAULT_AUTO_RECORD_MIN_KG = 40;
/** 設定の選択肢。0 は自動記録しない */
export const AUTO_RECORD_MIN_KG_OPTIONS = [0, 20, 30, 40, 50, 60];

/** 設定値を下限(kg)にする。null は自動記録しない。未設定・不正な値は既定値 */
export function parseAutoRecordMinKg(value: string | null): number | null {
  const kg = Number(value);
  if (value == null || value === '' || !Number.isFinite(kg) || kg < 0) {
    return DEFAULT_AUTO_RECORD_MIN_KG;
  }
  return kg === 0 ? null : kg;
}

export function shouldAutoRecord(weightKg: number, minKg: number | null): boolean {
  return minKg != null && weightKg >= minKg;
}
