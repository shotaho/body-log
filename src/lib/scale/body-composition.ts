/**
 * 体重・インピーダンス・プロフィールから体組成を推定する。
 * Xiaomi 公式アプリの算出式をコミュニティが解析した近似式に基づくため、公式アプリの値とは多少ずれる。
 */

export type Sex = 'male' | 'female';

export type BodyCompositionInput = {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  impedance: number;
};

export type BodyComposition = {
  bodyFatPct: number;
  muscleKg: number;
  waterPct: number;
  boneKg: number;
  visceralFat: number;
  bmrKcal: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** BMI(身長のみで計算できるのでインピーダンス不要)。 */
export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return clamp(weightKg / (m * m), 10, 90);
}

/** 生年月日 'YYYY-MM-DD' から満年齢。 */
export function ageOn(birthDate: string, today: Date): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) {
    age -= 1;
  }
  return age;
}

export function computeBodyComposition(input: BodyCompositionInput): BodyComposition {
  const { weightKg: w, heightCm: h, age, sex, impedance } = input;
  const female = sex === 'female';

  // 除脂肪量の係数
  const lbm =
    ((h * 9.058) / 100) * (h / 100) + w * 0.32 + 12.226 - impedance * 0.0068 - age * 0.0542;

  const bmrRaw = female
    ? 864.6 + w * 10.2036 - h * 0.39336 - age * 6.204
    : 877.8 + w * 14.916 - h * 0.726 - age * 8.976;
  const bmrKcal = Math.round(clamp(bmrRaw, 500, 10000));

  // 体脂肪率
  const fatConst = female ? (age <= 49 ? 9.25 : 7.25) : 0.8;
  let coefficient = 1.0;
  if (!female && w < 61) {
    coefficient = 0.98;
  } else if (female && w > 60) {
    coefficient = h > 160 ? 0.96 * 1.03 : 0.96;
  } else if (female && w < 50) {
    coefficient = h > 160 ? 1.02 * 1.03 : 1.02;
  }
  let fat = (1.0 - ((lbm - fatConst) * coefficient) / w) * 100;
  if (fat > 63) {
    fat = 75;
  }
  const bodyFatPct = clamp(fat, 5, 75);

  // 体水分率
  let water = (100 - bodyFatPct) * 0.7;
  water *= water <= 50 ? 1.02 : 0.98;
  if (water >= 65) {
    water = 75;
  }
  const waterPct = clamp(water, 35, 75);

  // 骨量
  let bone = lbm * 0.05158 - (female ? 0.245691014 : 0.18016894);
  bone += bone > 2.2 ? 0.1 : -0.1;
  if ((female && bone > 5.1) || (!female && bone > 5.2)) {
    bone = 8;
  }
  const boneKg = clamp(bone, 0.5, 8);

  // 筋肉量
  let muscle = w - (bodyFatPct / 100) * w - boneKg;
  if ((female && muscle >= 84) || (!female && muscle >= 93.5)) {
    muscle = 120;
  }
  const muscleKg = clamp(muscle, 10, 120);

  // 内臓脂肪レベル
  let visceral: number;
  if (female) {
    if (w > (13 - h * 0.5) * -1) {
      const sub = h * 1.45 + h * 0.1158 * h - 120;
      visceral = (w * 500) / sub - 6 + age * 0.07;
    } else {
      const sub = 0.691 + h * -0.0024 + h * -0.0024;
      visceral = (h * 0.027 - sub * w) * -1 + age * 0.07 - age;
    }
  } else if (h < w * 1.6) {
    const sub = (h * 0.4 - h * (h * 0.0826)) * -1;
    visceral = (w * 305) / (sub + 48) - 2.9 + age * 0.15;
  } else {
    const sub = 0.765 + h * -0.0015;
    visceral = (h * 0.143 - w * sub) * -1 + age * 0.15 - 5.0;
  }
  const visceralFat = clamp(visceral, 1, 50);

  return { bodyFatPct, muscleKg, waterPct, boneKg, visceralFat, bmrKcal };
}
