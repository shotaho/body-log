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

type Listener = {
  onAdvertisement: (ad: ScaleAdvertisement) => void;
  onStatus: (status: ScanStatus) => void;
  lowLatency: boolean;
};

/**
 * スキャンはアプリ全体で1つにまとめる(計測画面と自動記録が同時に使っても、互いに止め合わないように)。
 * 利用者がいる間だけスキャンし、1人でも lowLatency を求めていれば LowLatency、そうでなければ省電力の Balanced。
 */
const listeners = new Set<Listener>();
let currentStatus: ScanStatus = 'starting';
let stateSubscription: Subscription | null = null;
let starting = false;
let poweredOn = false;
let scanningMode: ScanMode | null = null;

function setStatus(status: ScanStatus) {
  currentStatus = status;
  listeners.forEach((l) => l.onStatus(status));
}

function updateScan() {
  const ble = getManager();
  if (listeners.size === 0 || !poweredOn) {
    if (scanningMode !== null) {
      ble.stopDeviceScan();
      scanningMode = null;
    }
    return;
  }
  const mode = [...listeners].some((l) => l.lowLatency) ? ScanMode.LowLatency : ScanMode.Balanced;
  if (scanningMode === mode) {
    return;
  }
  if (scanningMode !== null) {
    ble.stopDeviceScan();
  }
  scanningMode = mode;
  setStatus('scanning');
  const onError = () => {
    scanningMode = null;
    setStatus('error');
  };
  ble
    .startDeviceScan(null, { allowDuplicates: true, scanMode: mode }, (error, device) => {
      if (error) {
        onError();
        return;
      }
      const data = device && findScaleData(device.serviceData);
      const packet = data ? parseMiScale2(base64ToBytes(data)) : null;
      if (device && packet) {
        const ad = { deviceId: device.id, name: device.name ?? device.localName, packet };
        listeners.forEach((l) => l.onAdvertisement(ad));
      }
    })
    .catch(onError);
}

function ensureStarted() {
  if (stateSubscription || starting) {
    return;
  }
  starting = true;
  setStatus('starting');
  requestPermissions().then((granted) => {
    starting = false;
    if (listeners.size === 0) {
      return;
    }
    if (!granted) {
      setStatus('permission-denied');
      return;
    }
    stateSubscription = getManager().onStateChange((state) => {
      poweredOn = state === State.PoweredOn;
      updateScan();
      if (state === State.PoweredOff) {
        setStatus('bluetooth-off');
      } else if (state === State.Unsupported) {
        setStatus('unsupported');
      } else if (state === State.Unauthorized) {
        setStatus('permission-denied');
      }
    }, true);
  });
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener.onStatus(currentStatus);
  ensureStarted();
  updateScan();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      // 次に使うときに権限・Bluetooth の状態を確認し直す
      stateSubscription?.remove();
      stateSubscription = null;
      poweredOn = false;
    }
    updateScan();
  };
}

export type ScanOptions = {
  /** false の間はスキャンしない(既定 true) */
  enabled?: boolean;
  /** 素早く受信する(電池を多く使う)。計測画面向け。既定 true */
  lowLatency?: boolean;
};

/**
 * 使っている間だけ BLE スキャンし、Mi Body Composition Scale 2 のアドバタイズを onAdvertisement に渡す。
 * 接続はせず、アドバタイズ(ブロードキャスト)を受け取るだけ。
 */
export function useMiScaleScan(
  onAdvertisement: (ad: ScaleAdvertisement) => void,
  { enabled = true, lowLatency = true }: ScanOptions = {}
): ScanStatus {
  const [status, setStatusState] = useState<ScanStatus>('starting');
  const callback = useRef(onAdvertisement);
  useEffect(() => {
    callback.current = onAdvertisement;
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    return subscribe({
      onAdvertisement: (ad) => callback.current(ad),
      onStatus: setStatusState,
      lowLatency,
    });
  }, [enabled, lowLatency]);

  return status;
}
