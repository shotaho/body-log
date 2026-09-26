import { startOfDay, toLocalDateString } from '@/lib/date';

export type Measurement = { measuredAt: number; value: number };

/** 1日1点に集約した値。time はその日のローカル 0:00(エポックミリ秒)。 */
export type DailyPoint = { date: string; time: number; value: number };

const DAY_MS = 24 * 60 * 60 * 1000;

/** 1日に複数回の計測がある場合はその日の平均を取り、日付昇順で返す。 */
export function toDailySeries(measurements: Measurement[]): DailyPoint[] {
  const byDate = new Map<string, { sum: number; count: number; time: number }>();
  for (const m of measurements) {
    const d = new Date(m.measuredAt);
    const date = toLocalDateString(d);
    const entry = byDate.get(date);
    if (entry) {
      entry.sum += m.value;
      entry.count += 1;
    } else {
      byDate.set(date, {
        sum: m.value,
        count: 1,
        time: startOfDay(d).getTime(),
      });
    }
  }
  return [...byDate.entries()]
    .map(([date, { sum, count, time }]) => ({ date, time, value: sum / count }))
    .sort((a, b) => a.time - b.time);
}

/**
 * 後方 windowDays 日間(当日を含む)の移動平均。
 * 記録のない日は分母に含めず、期間内にある日の値だけで平均する。
 */
export function movingAverage(daily: DailyPoint[], windowDays = 7): DailyPoint[] {
  const result: DailyPoint[] = [];
  let start = 0;
  let sum = 0;
  for (let i = 0; i < daily.length; i++) {
    sum += daily[i].value;
    // DST をまたいでも日数で比較できるよう、時差分の余裕を持たせて判定する
    while (daily[i].time - daily[start].time > (windowDays - 1) * DAY_MS + DAY_MS / 2) {
      sum -= daily[start].value;
      start++;
    }
    result.push({ ...daily[i], value: sum / (i - start + 1) });
  }
  return result;
}

export type Range = 'week' | 'month' | 'year' | 'all';

const RANGE_DAYS: Record<Exclude<Range, 'all'>, number> = { week: 7, month: 30, year: 365 };

/** 表示期間の開始時刻(ローカル 0:00)。'all' は null。 */
export function rangeStart(range: Range, now: Date): number | null {
  if (range === 'all') {
    return null;
  }
  const start = startOfDay(now);
  start.setDate(start.getDate() - (RANGE_DAYS[range] - 1));
  return start.getTime();
}

/**
 * Y 軸の目盛り。データ範囲を含むきりのよい値(0.5 / 1 / 2 / 5 / 10 ... 刻み)を返す。
 * 値が1点だけ・全て同じでも幅が出るように上下に余白を取る。
 */
export function niceTicks(min: number, max: number, targetCount = 4): number[] {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const rawStep = (max - min) / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? 10 * magnitude;
  const niceStep = step < 0.5 ? 0.5 : step;
  const first = Math.floor(min / niceStep) * niceStep;
  const last = Math.ceil(max / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let v = first; v <= last + niceStep / 2; v += niceStep) {
    ticks.push(Math.round(v * 10) / 10);
  }
  return ticks;
}
