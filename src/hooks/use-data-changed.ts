import { useEffect, useRef } from 'react';

import { onDataChanged, type DataKind } from '@/lib/data-events';

/** 画面の外(自動記録など)でデータが変わったら callback を呼ぶ。 */
export function useOnDataChanged(kind: DataKind, callback: () => unknown): void {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });
  useEffect(() => onDataChanged(kind, () => latest.current()), [kind]);
}
