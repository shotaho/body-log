import { format1, parse1, round1 } from '@/lib/decimal';

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back';

/**
 * アプリ内テンキーの1キー分の入力を反映する。
 * - decimal: 小数点を許可するか(重量は許可、回数は整数のみ)
 * - 小数は第1位まで、整数部は maxIntDigits 桁まで
 * - 先頭の不要な 0 は付けない("0" の次に数字を押すと置き換え)
 */
export function applyKey(
  value: string,
  key: KeypadKey,
  { decimal, maxIntDigits }: { decimal: boolean; maxIntDigits: number }
): string {
  if (key === 'back') {
    return value.slice(0, -1);
  }
  const [intPart, fracPart] = value.split('.');
  if (key === '.') {
    if (!decimal || fracPart !== undefined) {
      return value;
    }
    return value === '' ? '0.' : `${value}.`;
  }
  if (fracPart !== undefined) {
    return fracPart.length >= 1 ? value : value + key;
  }
  if (intPart === '0') {
    return key;
  }
  return intPart.length >= maxIntDigits ? value : value + key;
}

/** 重量を delta(kg)だけ増減する。0 未満にはしない。空欄は 0 として扱う。 */
export function stepWeight(value: string, delta: number): string {
  const current = parse1(value) ?? 0;
  const next = Math.max(0, round1(current + delta));
  return format1(next);
}
