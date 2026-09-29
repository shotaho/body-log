import type { MiScale2Packet } from '@/lib/scale/mi-scale2';

/**
 * 体重計から届くパケット列を「1回の計測」にまとめる状態機械。
 *   waiting   乗るのを待っている
 *   measuring 体重が変動中(liveWeightKg を表示)
 *   stable    体重確定、インピーダンス(体組成)待ち
 *   done      インピーダンスまで取れた、または降りた
 */
export type MeasurementState =
  | { phase: 'waiting' }
  | { phase: 'measuring'; liveWeightKg: number }
  | { phase: 'stable' | 'done'; result: MeasurementResult };

export type MeasurementResult = {
  /** 同じ計測かどうかの判定キー(体重計の時計) */
  key: string;
  weightKg: number;
  impedance: number | null;
  measuredAt: Date;
};

export const INITIAL_MEASUREMENT: MeasurementState = { phase: 'waiting' };

export function reduceMeasurement(
  state: MeasurementState,
  packet: MiScale2Packet
): MeasurementState {
  if (!packet.stabilized) {
    if (packet.loadRemoved) {
      // 確定前に降りた。確定済みの結果があればそれを残す
      return state.phase === 'stable' ? { phase: 'done', result: state.result } : state;
    }
    // 確定済みの計測があっても、体重が変動し始めたら新しい計測
    return { phase: 'measuring', liveWeightKg: packet.weightKg };
  }

  const previous =
    (state.phase === 'stable' || state.phase === 'done') && state.result.key === packet.timestamp
      ? state.result
      : null;
  const result: MeasurementResult = {
    key: packet.timestamp,
    weightKg: packet.weightKg,
    impedance: packet.impedance ?? previous?.impedance ?? null,
    measuredAt: packet.measuredAt,
  };
  const done = result.impedance != null || packet.loadRemoved;
  return { phase: done ? 'done' : 'stable', result };
}

/**
 * 記録に使う計測日時。体重計の時計が合っていれば(端末時刻の24時間前〜5分後)それを使い、
 * 合っていなければ(時計未設定など)端末の現在時刻を使う。
 */
export function recordedAt(scaleTime: Date, now: Date): Date {
  const diff = now.getTime() - scaleTime.getTime();
  return diff <= 24 * 60 * 60 * 1000 && diff >= -5 * 60 * 1000 ? scaleTime : now;
}
