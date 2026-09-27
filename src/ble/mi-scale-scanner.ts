import { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, ScanMode, State, type Subscription } from 'react-native-ble-plx';

import { base64ToBytes, parseMiScale2, type MiScale2Packet } from '@/lib/scale/mi-scale2';

export type ScanStatus =
  | 'starting'
  | 'scanning'
  | 'permission-denied'
  | 'bluetooth-off'
  | 'unsupported'
  | 'error';

export type ScaleAdvertisement = {
  /** Android では MAC アドレス */
  deviceId: string;
  name: string | null;
  packet: MiScale2Packet;
};

let manager: BleManager | null = null;
const getManager = () => (manager ??= new BleManager());

/** Android の実行時権限。12 以降は BLUETOOTH_SCAN/CONNECT(位置情報は使わない)、11 以前は位置情報。 */
async function requestPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  if (Platform.Version >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(result).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/** サービスデータから Body Composition(0x181B)のデータを取り出す。UUID の表記ゆれ(短縮形・大文字)も許容する。 */
function findScaleData(serviceData: Record<string, string> | null): string | null {
  if (!serviceData) {
    return null;
  }
  const key = Object.keys(serviceData).find((k) => {
    const lower = k.toLowerCase();
    return lower === '181b' || lower.startsWith('0000181b-');
  });
  return key ? serviceData[key] : null;
}

/**
 * 画面を開いている間だけ BLE スキャンし、Mi Body Composition Scale 2 のアドバタイズを onAdvertisement に渡す。
 * 接続はせず、アドバタイズ(ブロードキャスト)を受け取るだけ。
 */
export function useMiScaleScan(onAdvertisement: (ad: ScaleAdvertisement) => void): ScanStatus {
  const [status, setStatus] = useState<ScanStatus>('starting');
  const callback = useRef(onAdvertisement);
  useEffect(() => {
    callback.current = onAdvertisement;
  });

  useEffect(() => {
    const ble = getManager();
    let cancelled = false;
    let stateSubscription: Subscription | undefined;

    const startScan = () => {
      setStatus('scanning');
      ble
        .startDeviceScan(
          null,
          { allowDuplicates: true, scanMode: ScanMode.LowLatency },
          (error, device) => {
            if (error) {
              setStatus('error');
              return;
            }
            const data = device && findScaleData(device.serviceData);
            const packet = data ? parseMiScale2(base64ToBytes(data)) : null;
            if (device && packet) {
              callback.current({
                deviceId: device.id,
                name: device.name ?? device.localName,
                packet,
              });
            }
          }
        )
        .catch(() => setStatus('error'));
    };

    requestPermissions().then((granted) => {
      if (cancelled) {
        return;
      }
      if (!granted) {
        setStatus('permission-denied');
        return;
      }
      stateSubscription = ble.onStateChange((state) => {
        if (state === State.PoweredOn) {
          startScan();
        } else if (state === State.PoweredOff) {
          ble.stopDeviceScan();
          setStatus('bluetooth-off');
        } else if (state === State.Unsupported) {
          setStatus('unsupported');
        } else if (state === State.Unauthorized) {
          setStatus('permission-denied');
        }
      }, true);
    });

    return () => {
      cancelled = true;
      stateSubscription?.remove();
      ble.stopDeviceScan();
    };
  }, []);

  return status;
}
