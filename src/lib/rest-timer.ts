/** レストタイマーと、セット時間・レスト時間の計算。 */

export const DEFAULT_REST_SECONDS = 90;
export const REST_SECONDS_OPTIONS = [30, 45, 60, 90, 120, 150, 180, 240, 300];
/** 残りこの秒数になったら予告の音を鳴らす */
export const WARNING_SECONDS = 10;

/** 残り秒数(切り上げ、0 未満にはしない)。 */
export function remainingSeconds(endAt: number, now: number): number {
  return Math.max(0, Math.ceil((endAt - now) / 1000));
}

export type Beep = 'warning' | 'end';

/**
 * 前回の残り秒数から今回の残り秒数に変わったときに鳴らす音。
 * 残り10秒になった瞬間に 'warning'、0 になった瞬間に 'end'。
 * 表示の更新が飛んでも(例: 12 → 9)境界をまたいだら鳴らす。
 */
export function beepFor(previous: number, current: number): Beep | null {
  if (previous > 0 && current === 0) {
    return 'end';
  }
  if (previous > WARNING_SECONDS && current <= WARNING_SECONDS && current > 0) {
    return 'warning';
  }
  return null;
}

/** 'm:ss' 表示。 */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export type RestTimer = {
  /** 開始(直前のセットを記録した)時刻 */
  startedAt: number;
  /** 終了予定時刻 */
  endAt: number;
  /** スキップした時刻。スキップしていなければ null */
  skippedAt: number | null;
};

/**
 * 次のセットの開始時刻(案B: レストタイマーが終わった時刻を開始とみなす)。
 * - タイマーが終わっていれば終了予定時刻、スキップしていればスキップした時刻
 * - タイマーが動いている途中でセットを記録した、タイマーがない場合は不明(null)
 */
export function nextSetStartedAt(timer: RestTimer | null, now: number): number | null {
  if (!timer) {
    return null;
  }
  if (timer.skippedAt != null) {
    return timer.skippedAt;
  }
  return now >= timer.endAt ? timer.endAt : null;
}

export type SetTiming = {
  /** セット時間(秒)。開始時刻が不明なら null */
  setSeconds: number | null;
  /** 前のセットからのレスト時間(秒)。前のセットがない・開始時刻が不明なら null */
  restSeconds: number | null;
};

/** セット時間とレスト時間を、ワークアウト内のセット順(全種目通し)で計算する。 */
export function setTimings(
  sets: { id: number; startedAt: number | null; completedAt: number | null }[]
): Map<number, SetTiming> {
  const timings = new Map<number, SetTiming>();
  let previousCompletedAt: number | null = null;
  for (const s of sets) {
    const setSeconds =
      s.startedAt != null && s.completedAt != null && s.completedAt >= s.startedAt
        ? (s.completedAt - s.startedAt) / 1000
        : null;
    const restSeconds =
      s.startedAt != null && previousCompletedAt != null && s.startedAt >= previousCompletedAt
        ? (s.startedAt - previousCompletedAt) / 1000
        : null;
    timings.set(s.id, { setSeconds, restSeconds });
    if (s.completedAt != null) {
      previousCompletedAt = s.completedAt;
    }
  }
  return timings;
}
