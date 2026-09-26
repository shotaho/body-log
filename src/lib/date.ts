/** 端末ローカル時刻での日付文字列 'YYYY-MM-DD'(workout.date の形式)。 */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** その日のローカル 0:00。 */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** その週の月曜日 0:00(ローカル時刻)。 */
export function startOfWeek(date: Date): Date {
  const result = startOfDay(date);
  const daysSinceMonday = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - daysSinceMonday);
  return result;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 表示用: '9月26日(土)' */
export function formatDateJa(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日(${WEEKDAYS[date.getDay()]})`;
}
