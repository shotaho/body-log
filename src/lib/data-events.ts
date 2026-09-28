/** 画面の外(自動記録など)でデータが変わったことを、表示中の画面に知らせる。 */

export type DataKind = 'body_record';

const listeners = new Map<DataKind, Set<() => void>>();

export function onDataChanged(kind: DataKind, listener: () => void): () => void {
  const set = listeners.get(kind) ?? new Set();
  listeners.set(kind, set);
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

export function emitDataChanged(kind: DataKind): void {
  listeners.get(kind)?.forEach((l) => l());
}
