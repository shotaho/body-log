import { render, screen } from '@testing-library/react-native';

import { BodyMap } from '../body-map';

describe('BodyMap', () => {
  it('鍛えた部位を読み上げ用ラベルと凡例で示す', async () => {
    await render(
      <BodyMap levels={{ chest: 4, back: 0, legs: 2, shoulders: 0, arms: 1, abs: 0, other: 3 }} />
    );
    // 「その他」はイラストに出さない
    expect(screen.getByLabelText('全身イラスト。鍛えた部位: 胸、脚、腕')).toBeTruthy();
    expect(screen.getByText('未実施')).toBeTruthy();
    expect(screen.getByText('前')).toBeTruthy();
    expect(screen.getByText('後ろ')).toBeTruthy();
  });

  it('何もしていなければ「なし」', async () => {
    await render(
      <BodyMap levels={{ chest: 0, back: 0, legs: 0, shoulders: 0, arms: 0, abs: 0, other: 0 }} />
    );
    expect(screen.getByLabelText('全身イラスト。鍛えた部位: なし')).toBeTruthy();
  });
});
