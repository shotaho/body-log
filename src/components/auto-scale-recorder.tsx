import { usePathname } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMiScaleScan, type ScaleAdvertisement } from '@/ble/mi-scale-scanner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { hasScaleRecord, insertScaleRecord } from '@/db/body-records';
import { getProfile } from '@/db/profile';
import { getRegisteredScale, type ScaleDevice } from '@/db/scale-devices';
import { getSetting } from '@/db/settings';
import { emitDataChanged } from '@/lib/data-events';
import { format1 } from '@/lib/decimal';
import {
  AUTO_RECORD_SETTING_KEY,
  parseAutoRecordMinKg,
  shouldAutoRecord,
} from '@/lib/scale/auto-record';
import {
  INITIAL_MEASUREMENT,
  reduceMeasurement,
  type MeasurementResult,
} from '@/lib/scale/measurement';
import { toScaleRecord } from '@/lib/scale/record';

const SCALE_SCREEN = '/weight/scale';
const MESSAGE_MS = 4000;

type KeyStatus = 'checking' | 'saved' | 'new' | 'saving' | 'skipped';

function useAppActive() {
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setActive(state === 'active')
    );
    return () => subscription.remove();
  }, []);
  return active;
}

/**
 * アプリを表示している間、登録済みの体重計に乗ったら自動で記録する(下限未満の体重は記録しない)。
 * 計測画面を開いている間は、その画面で確認して保存するので何もしない。
 */
export function AutoScaleRecorder() {
  const db = useSQLiteContext();
  const pathname = usePathname();
  const active = useAppActive();
  const insets = useSafeAreaInsets();
  const [scale, setScale] = useState<ScaleDevice | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const measurement = useRef(INITIAL_MEASUREMENT);
  /** 確定した計測キーごとの状態。保存済みの計測(体重計が前回分を送り続ける)を二重に記録しないため */
  const keyStatus = useRef(new Map<string, KeyStatus>());

  // 計測画面で登録・設定画面で解除されることがあるので、画面が変わるたびに読み直す
  useEffect(() => {
    getRegisteredScale(db).then(setScale);
  }, [db, pathname]);

  useEffect(() => {
    if (!message) {
      return;
    }
    const id = setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => clearTimeout(id);
  }, [message]);

  const save = async (macAddress: string, result: MeasurementResult) => {
    const key = `${macAddress}|${result.key}`;
    keyStatus.current.set(key, 'saving');
    const minKg = parseAutoRecordMinKg(await getSetting(db, AUTO_RECORD_SETTING_KEY));
    if (!shouldAutoRecord(result.weightKg, minKg)) {
      keyStatus.current.set(key, 'skipped');
      return;
    }
    const record = toScaleRecord(result, macAddress, await getProfile(db), new Date());
    const inserted = await insertScaleRecord(db, record);
    keyStatus.current.set(key, 'saved');
    if (inserted) {
      emitDataChanged('body_record');
      setMessage(`体重 ${format1(record.weightKg)} kg を自動で記録しました`);
    }
  };

  const onAdvertisement = ({ deviceId, packet }: ScaleAdvertisement) => {
    if (!scale || deviceId !== scale.macAddress) {
      return;
    }
    if (packet.stabilized) {
      const key = `${deviceId}|${packet.timestamp}`;
      const status = keyStatus.current.get(key);
      if (status === undefined) {
        keyStatus.current.set(key, 'checking');
        hasScaleRecord(db, key).then((saved) =>
          keyStatus.current.set(key, saved ? 'saved' : 'new')
        );
        return;
      }
      if (status !== 'new') {
        return;
      }
    }
    const next = reduceMeasurement(measurement.current, packet);
    measurement.current = next;
    if (
      next.phase === 'done' &&
      keyStatus.current.get(`${deviceId}|${next.result.key}`) === 'new'
    ) {
      save(deviceId, next.result);
    }
  };

  useMiScaleScan(onAdvertisement, {
    enabled: scale != null && active && pathname !== SCALE_SCREEN,
    lowLatency: false,
  });

  if (!message) {
    return null;
  }
  return (
    <ThemedView
      type="backgroundSelected"
      style={[styles.banner, { top: insets.top + Spacing.two }]}
      pointerEvents="none"
      accessibilityLiveRegion="polite">
      <ThemedText type="smallBold">{message}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    elevation: 4,
  },
});
