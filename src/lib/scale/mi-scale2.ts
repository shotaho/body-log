/**
 * Xiaomi Mi Body Composition Scale 2(XMTZC05HM)のアドバタイズ解析。
 *
 * 体重計は Body Composition サービス(0x181B)のサービスデータとして 13 バイトを暗号化せずに送ってくる。
 *   [0]     制御バイト0(単位)   bit0: lbs, bit4: 斤
 *   [1]     制御バイト1          bit1: インピーダンスあり, bit5: 体重確定, bit7: 体重計から降りた
 *   [2..3]  年(リトルエンディアン)
 *   [4..8]  月, 日, 時, 分, 秒(体重計の時計)
 *   [9..10] インピーダンス(Ω, LE)
 *   [11..12] 体重(LE)。kg は 1/200、lbs・斤は 1/100 単位
 * 非公式な仕様(コミュニティでの解析結果)に基づく。
 */

export const MI_SCALE2_SERVICE_UUID = '0000181b-0000-1000-8000-00805f9b34fb';

export type ScaleUnit = 'kg' | 'lbs' | 'jin';

export type MiScale2Packet = {
  /** kg に換算した体重(丸め前) */
  weightKg: number;
  unit: ScaleUnit;
  /** インピーダンス(Ω)。測れていなければ null */
  impedance: number | null;
  stabilized: boolean;
  loadRemoved: boolean;
  /** 体重計の時計での計測時刻 'YYYY-MM-DD HH:MM:SS'。同じ計測かどうかの判定に使う */
  timestamp: string;
  /** timestamp を端末のローカル時刻として解釈したもの */
  measuredAt: Date;
};

const LBS_TO_KG = 0.45359237;
const JIN_TO_KG = 0.5;

const pad = (n: number) => String(n).padStart(2, '0');

export function parseMiScale2(data: Uint8Array): MiScale2Packet | null {
  if (data.length !== 13) {
    return null;
  }
  const control0 = data[0];
  const control1 = data[1];
  const u16 = (i: number) => data[i] | (data[i + 1] << 8);

  const unit: ScaleUnit = control0 & 0x10 ? 'jin' : control0 & 0x01 ? 'lbs' : 'kg';
  const raw = u16(11);
  const weightKg =
    unit === 'kg' ? raw / 200 : unit === 'lbs' ? (raw / 100) * LBS_TO_KG : (raw / 100) * JIN_TO_KG;

  const impedanceRaw = u16(9);
  const hasImpedance = (control1 & 0x02) !== 0 && impedanceRaw > 0 && impedanceRaw < 3000;

  const [year, month, day, hour, minute, second] = [
    u16(2),
    data[4],
    data[5],
    data[6],
    data[7],
    data[8],
  ];

  return {
    weightKg,
    unit,
    impedance: hasImpedance ? impedanceRaw : null,
    stabilized: (control1 & 0x20) !== 0,
    loadRemoved: (control1 & 0x80) !== 0,
    timestamp: `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`,
    measuredAt: new Date(year, month - 1, day, hour, minute, second),
  };
}

/** Base64(ble-plx の serviceData の形式)をバイト列に。 */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
