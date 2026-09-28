import { useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { getSetting, setSetting } from '@/db/settings';
import {
  beepFor,
  DEFAULT_REST_SECONDS,
  nextSetStartedAt,
  remainingSeconds,
  type RestTimer,
} from '@/lib/rest-timer';

const SETTING_KEY = 'rest_seconds';
const TICK_MS = 250;

type RestTimerContextValue = {
  /** 設定のレスト時間(秒) */
  restSeconds: number;
  setRestSeconds: (seconds: number) => void;
  timer: RestTimer | null;
  /** 残り秒数(タイマーがなければ 0) */
  remaining: number;
  /** セットを記録した時に呼ぶ。次のセットの開始時刻(案B)を返し、新しいレストを始める */
  onSetCompleted: (now: number) => number | null;
  skip: () => void;
  /** 残り時間を増減する(秒) */
  adjust: (seconds: number) => void;
  dismiss: () => void;
};

const RestTimerContext = createContext<RestTimerContextValue | null>(null);

function replay(player: AudioPlayer) {
  player.seekTo(0).then(() => player.play());
}

/**
 * アプリ全体で1つのレストタイマー。画面を移動しても動き続ける。
 * 残り10秒と0秒で音を1回ずつ鳴らす(アプリ表示中のみ。音量・マナーモードは端末の設定に従う)。
 */
export function RestTimerProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [restSeconds, setRestSecondsState] = useState(DEFAULT_REST_SECONDS);
  const [timer, setTimer] = useState<RestTimer | null>(null);
  const [remaining, setRemaining] = useState(0);
  const previousRemaining = useRef(0);
  const warningPlayer = useAudioPlayer(require('@/assets/sounds/rest-warning.wav'));
  const endPlayer = useAudioPlayer(require('@/assets/sounds/rest-end.wav'));

  useEffect(() => {
    getSetting(db, SETTING_KEY).then((value) => {
      const seconds = Number(value);
      if (value != null && Number.isInteger(seconds) && seconds > 0) {
        setRestSecondsState(seconds);
      }
    });
  }, [db]);

  // タイマー動作中だけ時計を回す
  useEffect(() => {
    if (!timer || timer.skippedAt != null) {
      return;
    }
    let id: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const current = remainingSeconds(timer.endAt, Date.now());
      const beep = beepFor(previousRemaining.current, current);
      if (beep === 'warning') {
        replay(warningPlayer);
      } else if (beep === 'end') {
        replay(endPlayer);
      }
      previousRemaining.current = current;
      setRemaining(current);
      if (current === 0 && id !== undefined) {
        // 終了したら時計を止める(延長されたら timer が変わって再開する)
        clearInterval(id);
      }
    };
    id = setInterval(tick, TICK_MS);
    tick();
    return () => clearInterval(id);
  }, [timer, warningPlayer, endPlayer]);

  const setRestSeconds = useCallback(
    (seconds: number) => {
      setRestSecondsState(seconds);
      setSetting(db, SETTING_KEY, String(seconds));
    },
    [db]
  );

  const onSetCompleted = useCallback(
    (now: number) => {
      const startedAt = nextSetStartedAt(timer, now);
      previousRemaining.current = restSeconds;
      setTimer({ startedAt: now, endAt: now + restSeconds * 1000, skippedAt: null });
      return startedAt;
    },
    [timer, restSeconds]
  );

  const skip = useCallback(() => {
    setTimer((t) => (t && t.skippedAt == null ? { ...t, skippedAt: Date.now() } : t));
    setRemaining(0);
    previousRemaining.current = 0;
  }, []);

  const adjust = useCallback((seconds: number) => {
    setTimer((t) => {
      if (!t || t.skippedAt != null) {
        return t;
      }
      const endAt = Math.max(Date.now(), t.endAt + seconds * 1000);
      // 延長で残り10秒より前に戻ったら、もう一度予告音を鳴らせるようにする
      previousRemaining.current = remainingSeconds(endAt, Date.now());
      return { ...t, endAt };
    });
  }, []);

  const dismiss = useCallback(() => {
    setTimer(null);
    setRemaining(0);
    previousRemaining.current = 0;
  }, []);

  return (
    <RestTimerContext.Provider
      value={{
        restSeconds,
        setRestSeconds,
        timer,
        remaining,
        onSetCompleted,
        skip,
        adjust,
        dismiss,
      }}>
      {children}
    </RestTimerContext.Provider>
  );
}

export function useRestTimer() {
  const context = useContext(RestTimerContext);
  if (!context) {
    throw new Error('useRestTimer must be used within RestTimerProvider');
  }
  return context;
}
