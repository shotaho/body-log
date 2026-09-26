/**
 * 体重・重量・体脂肪率などは小数点第1位まで扱う(仕様 1章)。
 * 入力・表示・保存のすべてでこのモジュールを通して丸める。
 */

/** 小数点第1位に丸める(四捨五入)。浮動小数の誤差で 0.05 が切り捨てられないよう EPSILON を足す。 */
export function round1(value: number): number {
  return Math.round((value + Math.sign(value) * Number.EPSILON) * 10) / 10;
}

/** 表示用に常に小数点第1位まで出す(例: 65 → "65.0")。 */
export function format1(value: number): string {
  return round1(value).toFixed(1);
}

/**
 * ユーザー入力を数値に変換し、小数点第1位に丸める。
 * 全角数字・全角ピリオド・カンマ区切りの小数も受け付ける。
 * 数値として解釈できない場合は null。
 */
export function parse1(input: string): number | null {
  const normalized = input
    .trim()
    .replace(/[\uFF10-\uFF19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,\uFF0C\uFF0E\u3001]/g, '.');
  if (!/^-?\d+(\.\d*)?$|^-?\.\d+$/.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? round1(value) : null;
}
