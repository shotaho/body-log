import { shadeLevel, volumeByBodyPart } from '../body-map';
import { applyKey, stepWeight } from '../keypad';
import {
  beepFor,
  formatDuration,
  nextSetStartedAt,
  remainingSeconds,
  restAlerts,
  setTimings,
} from '../rest-timer';

describe('applyKey', () => {
  const weight = { decimal: true, maxIntDigits: 4 };
  const reps = { decimal: false, maxIntDigits: 3 };
  const type = (keys: string[], opts: typeof weight) =>
    keys.reduce((v, k) => applyKey(v, k as never, opts), '');

  it('1文字目から入力できる', () => {
    expect(applyKey('', '6', weight)).toBe('6');
    expect(type(['6', '2', '.', '5'], weight)).toBe('62.5');
  });

  it('小数は第1位まで、小数点は1つだけ', () => {
    expect(type(['6', '2', '.', '5', '5'], weight)).toBe('62.5');
    expect(type(['6', '.', '.', '5'], weight)).toBe('6.5');
    expect(type(['.', '5'], weight)).toBe('0.5');
  });

  it('先頭の 0 は置き換え、桁数を制限する', () => {
    expect(type(['0', '7'], weight)).toBe('7');
    expect(type(['1', '2', '3', '4', '5'], weight)).toBe('1234');
    expect(type(['1', '2', '3', '4'], reps)).toBe('123');
  });

  it('回数は小数点を受け付けない', () => {
    expect(type(['1', '.', '2'], reps)).toBe('12');
  });

  it('削除', () => {
    expect(applyKey('62.5', 'back', weight)).toBe('62.');
    expect(applyKey('', 'back', weight)).toBe('');
  });
});

describe('stepWeight', () => {
  it('±5 / ±2.5 kg で増減し、0 未満にしない', () => {
    expect(stepWeight('60.0', 5)).toBe('65.0');
    expect(stepWeight('60', -2.5)).toBe('57.5');
    expect(stepWeight('', 2.5)).toBe('2.5');
    expect(stepWeight('2.5', -5)).toBe('0.0');
  });
});

describe('rest timer', () => {
  it('残り秒数は切り上げ、0 未満にしない', () => {
    expect(remainingSeconds(10_000, 0)).toBe(10);
    expect(remainingSeconds(10_000, 9_001)).toBe(1);
    expect(remainingSeconds(10_000, 12_000)).toBe(0);
  });

  it('残り10秒と0秒で1回ずつ鳴らす', () => {
    expect(beepFor(11, 10)).toBe('warning');
    expect(beepFor(12, 9)).toBe('warning'); // 表示の更新が飛んでも鳴らす
    expect(beepFor(10, 9)).toBeNull();
    expect(beepFor(1, 0)).toBe('end');
    expect(beepFor(0, 0)).toBeNull();
    expect(beepFor(90, 89)).toBeNull();
  });

  it('画面オフ用の通知は残り10秒と終了の2件(過ぎたものは除く)', () => {
    expect(restAlerts(90_000, 0)).toEqual([
      { kind: 'warning', at: 80_000 },
      { kind: 'end', at: 90_000 },
    ]);
    expect(restAlerts(90_000, 85_000)).toEqual([{ kind: 'end', at: 90_000 }]);
    expect(restAlerts(90_000, 95_000)).toEqual([]);
  });

  it('m:ss 表示', () => {
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(5.4)).toBe('0:05');
  });

  it('次のセットの開始時刻はタイマー終了時刻(案B)', () => {
    const timer = { startedAt: 0, endAt: 90_000, skippedAt: null };
    expect(nextSetStartedAt(timer, 120_000)).toBe(90_000);
    expect(nextSetStartedAt(timer, 60_000)).toBeNull(); // タイマー中に記録 → 不明
    expect(nextSetStartedAt({ ...timer, skippedAt: 40_000 }, 60_000)).toBe(40_000);
    expect(nextSetStartedAt(null, 60_000)).toBeNull();
  });

  it('セット時間とレスト時間', () => {
    const timings = setTimings([
      { id: 1, startedAt: null, completedAt: 100_000 },
      { id: 2, startedAt: 190_000, completedAt: 230_000 },
      { id: 3, startedAt: null, completedAt: 300_000 },
      { id: 4, startedAt: null, completedAt: null }, // 前回コピー
    ]);
    expect(timings.get(1)).toEqual({ setSeconds: null, restSeconds: null });
    expect(timings.get(2)).toEqual({ setSeconds: 40, restSeconds: 90 });
    expect(timings.get(3)).toEqual({ setSeconds: null, restSeconds: null });
    expect(timings.get(4)).toEqual({ setSeconds: null, restSeconds: null });
  });
});

describe('body map', () => {
  it('部位ごとのボリューム(自重は 1kg 相当)', () => {
    const v = volumeByBodyPart([
      { bodyPart: 'chest', weightKg: 60, reps: 10 },
      { bodyPart: 'chest', weightKg: 60, reps: 8 },
      { bodyPart: 'abs', weightKg: 0, reps: 20 },
    ]);
    expect(v.chest).toBe(1080);
    expect(v.abs).toBe(20);
    expect(v.legs).toBe(0);
  });

  it('塗りの段階は最大の部位が 4、行った部位は最低 1', () => {
    expect(shadeLevel(1080, 1080)).toBe(4);
    expect(shadeLevel(20, 1080)).toBe(1);
    expect(shadeLevel(540, 1080)).toBe(2);
    expect(shadeLevel(0, 1080)).toBe(0);
  });
});
