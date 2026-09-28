import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';

import { RestTimerBar } from '../rest-timer-bar';
import { RestTimerProvider, useRestTimer } from '../rest-timer-provider';

const played: string[] = [];

jest.mock('expo-audio', () => ({
  useAudioPlayer: (source: string) => ({
    seekTo: () => Promise.resolve(),
    play: () => played.push(source),
  }),
}));
jest.mock('@/assets/sounds/rest-warning.wav', () => 'warning');
jest.mock('@/assets/sounds/rest-end.wav', () => 'end');
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => ({}) }));
jest.mock('@/db/settings', () => ({
  getSetting: () => Promise.resolve('30'),
  setSetting: () => Promise.resolve(),
}));

/** テストから Provider の値を操作するための受け皿(描画後に更新する) */
const captured: { current?: ReturnType<typeof useRestTimer> } = {};
const api = () => captured.current!;
function Capture() {
  const value = useRestTimer();
  useEffect(() => {
    captured.current = value;
  });
  return null;
}

async function setup() {
  await render(
    <RestTimerProvider>
      <Capture />
      <RestTimerBar />
    </RestTimerProvider>
  );
}

beforeEach(() => {
  played.length = 0;
  jest.useFakeTimers({ now: 1_000_000 });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('レストタイマー', () => {
  it('設定の秒数で始まり、残り10秒と0秒で1回ずつ音を鳴らす', async () => {
    await setup();
    // 設定(30秒)の読み込みを待つ
    await act(async () => {});
    expect(api().restSeconds).toBe(30);

    await act(async () => {
      expect(api().onSetCompleted(Date.now())).toBeNull(); // 最初のセットは開始時刻不明
    });
    expect(screen.getByText('0:30')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    expect(screen.getByText('0:10')).toBeTruthy();
    expect(played).toEqual(['warning']);

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(played).toEqual(['warning', 'end']);
    expect(screen.getByText('次のセットへ')).toBeTruthy();

    // タイマー終了後に記録したセットの開始時刻は、タイマーの終了時刻(案B)
    const endAt = api().timer!.endAt;
    await act(async () => {
      jest.advanceTimersByTime(40_000);
    });
    let startedAt: number | null = null;
    await act(async () => {
      startedAt = api().onSetCompleted(Date.now());
    });
    expect(startedAt).toBe(endAt);
  });

  it('スキップした時刻を次のセットの開始とし、音は鳴らさない', async () => {
    await setup();
    await act(async () => {});
    await act(async () => {
      api().onSetCompleted(Date.now());
    });
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });
    await fireEvent.press(screen.getByText('スキップ'));
    const skippedAt = Date.now();
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(played).toEqual([]);
    let startedAt: number | null = null;
    await act(async () => {
      startedAt = api().onSetCompleted(Date.now());
    });
    expect(startedAt).toBe(skippedAt);
  });

  it('+15秒で延長できる', async () => {
    await setup();
    await act(async () => {});
    await act(async () => {
      api().onSetCompleted(Date.now());
    });
    await fireEvent.press(screen.getByText('+15秒'));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(screen.getByText('0:45')).toBeTruthy();
  });
});
