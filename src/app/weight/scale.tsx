import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { useMiScaleScan, type ScaleAdvertisement, type ScanStatus } from '@/ble/mi-scale-scanner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CompositionList } from '@/components/composition-list';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { hasScaleRecord, insertScaleRecord } from '@/db/body-records';
import { EMPTY_PROFILE, getProfile, isProfileComplete, type Profile } from '@/db/profile';
import { getRegisteredScale, registerScale, type ScaleDevice } from '@/db/scale-devices';
import { format1 } from '@/lib/decimal';
import { INITIAL_MEASUREMENT, reduceMeasurement } from '@/lib/scale/measurement';
import { toScaleRecord } from '@/lib/scale/record';

const SCALE_MODEL = 'XMTZC05HM';

const STATUS_MESSAGES: Partial<Record<ScanStatus, string>> = {
  starting: 'Bluetooth を準備しています…',
  'permission-denied':
    'Bluetooth(付近のデバイス)の権限がありません。設定アプリで権限を許可してください。',
  'bluetooth-off': 'Bluetooth がオフです。オンにしてください。',
  unsupported: 'この端末は Bluetooth LE に対応していません。',
  error: 'スキャンを開始できませんでした。画面を開き直してください。',
};

type Candidate = { deviceId: string; name: string | null; weightKg: number };

export default function ScaleScreen() {
  const db = useSQLiteContext();
  // undefined: 読み込み中
  const [scale, setScale] = useState<ScaleDevice | null>();
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [measurement, dispatch] = useReducer(reduceMeasurement, INITIAL_MEASUREMENT);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  /** 確定した計測キーごとの状態。保存済みの計測(体重計が前回分を送り続ける)を無視するため */
  const keyStatus = useRef(new Map<string, 'checking' | 'saved' | 'new'>());

  useEffect(() => {
    getRegisteredScale(db).then(setScale);
  }, [db]);

  // 設定画面でプロフィールを入力して戻ってきたときに反映する
  useFocusEffect(
    useCallback(() => {
      getProfile(db).then(setProfile);
    }, [db])
  );

  const onAdvertisement = ({ deviceId, name, packet }: ScaleAdvertisement) => {
    if (scale === undefined) {
      return;
    }
    if (scale === null) {
      // 未登録: 見つかった体重計を候補として出す
      setCandidates((prev) => [
        ...prev.filter((c) => c.deviceId !== deviceId),
        { deviceId, name, weightKg: packet.weightKg },
      ]);
      return;
    }
    if (deviceId !== scale.macAddress) {
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
    dispatch(packet);
  };

  const scanStatus = useMiScaleScan(onAdvertisement);

  const register = async (candidate: Candidate) => {
    const device = { macAddress: candidate.deviceId, model: SCALE_MODEL, name: candidate.name };
    await registerScale(db, device);
    setScale(await getRegisteredScale(db));
    setCandidates([]);
  };

  const result =
    measurement.phase === 'stable' || measurement.phase === 'done' ? measurement.result : null;
  const record =
    result && scale ? toScaleRecord(result, scale.macAddress, profile, new Date()) : null;
  const saved = record != null && savedKey === record.scaleKey;

  const save = async () => {
    if (!record) {
      return;
    }
    await insertScaleRecord(db, record);
    keyStatus.current.set(record.scaleKey, 'saved');
    setSavedKey(record.scaleKey);
  };

  const statusMessage = STATUS_MESSAGES[scanStatus];

  return (
    <Screen>
      {statusMessage && (
        <Card>
          <ThemedText>{statusMessage}</ThemedText>
          {scanStatus === 'permission-denied' && (
            <Button title="設定アプリを開く" onPress={() => Linking.openSettings()} />
          )}
        </Card>
      )}

      {scale === null && scanStatus === 'scanning' && (
        <Card title="体重計の登録">
          <ThemedText>
            体重計(Mi Body Composition Scale
            2)に乗ると、ここに表示されます。自分の体重計を選んで登録してください。
          </ThemedText>
          {candidates.map((c) => (
            <View key={c.deviceId} style={styles.candidate}>
              <View style={styles.flex}>
                <ThemedText>{c.name ?? '体重計'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {c.deviceId} · {format1(c.weightKg)} kg
                </ThemedText>
              </View>
              <Button title="登録" onPress={() => register(c)} />
            </View>
          ))}
        </Card>
      )}

      {scale && scanStatus === 'scanning' && (
        <>
          <Card>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              {measurement.phase === 'waiting' && '体重計に乗ってください'}
              {measurement.phase === 'measuring' && '計測中…'}
              {measurement.phase === 'stable' && '体組成を計測中… 裸足のまま乗っていてください'}
              {measurement.phase === 'done' && (saved ? '保存しました' : '計測完了')}
            </ThemedText>
            <ThemedText
              style={[styles.weight, measurement.phase === 'measuring' && styles.live]}
              accessibilityLiveRegion="polite">
              {measurement.phase === 'measuring'
                ? format1(measurement.liveWeightKg)
                : result
                  ? format1(result.weightKg)
                  : '--.-'}
              <ThemedText style={styles.unit}> kg</ThemedText>
            </ThemedText>
          </Card>

          {record && (
            <Card title="体組成">
              <CompositionList values={record} />
              {measurement.phase === 'done' && result?.impedance == null && (
                <ThemedText type="small" themeColor="textSecondary">
                  体組成は計測できませんでした。裸足で、電極に足をしっかり乗せて計測してください。
                </ThemedText>
              )}
              {result?.impedance != null && !isProfileComplete(profile) && (
                <>
                  <ThemedText type="small" themeColor="textSecondary">
                    体脂肪率などを計算するには、設定でプロフィール(身長・生年月日・性別)を入力してください。
                  </ThemedText>
                  <Button title="プロフィールを入力" onPress={() => router.push('/settings')} />
                </>
              )}
            </Card>
          )}

          {record && !saved && <Button title="保存" onPress={save} />}
          {saved && <Button title="記録一覧へ" onPress={() => router.back()} />}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  weight: {
    fontSize: 56,
    lineHeight: 68,
    fontWeight: 700,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  live: {
    opacity: 0.5,
  },
  unit: {
    fontSize: 20,
    fontWeight: 500,
  },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
