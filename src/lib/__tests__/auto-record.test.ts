import { emitDataChanged, onDataChanged } from '../data-events';
import {
  DEFAULT_AUTO_RECORD_MIN_KG,
  parseAutoRecordMinKg,
  shouldAutoRecord,
} from '../scale/auto-record';

describe('自動記録', () => {
  it('未設定なら既定の下限、0 ならオフ', () => {
    expect(parseAutoRecordMinKg(null)).toBe(DEFAULT_AUTO_RECORD_MIN_KG);
    expect(parseAutoRecordMinKg('abc')).toBe(DEFAULT_AUTO_RECORD_MIN_KG);
    expect(parseAutoRecordMinKg('30')).toBe(30);
    expect(parseAutoRecordMinKg('0')).toBeNull();
  });

  it('下限未満は記録しない', () => {
    expect(shouldAutoRecord(39.9, 40)).toBe(false);
    expect(shouldAutoRecord(40, 40)).toBe(true);
    expect(shouldAutoRecord(70, null)).toBe(false);
  });
});

describe('data events', () => {
  it('購読中だけ通知される', () => {
    const listener = jest.fn();
    const unsubscribe = onDataChanged('body_record', listener);
    emitDataChanged('body_record');
    unsubscribe();
    emitDataChanged('body_record');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
