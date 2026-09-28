import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';

import { findOrCreateWorkout } from '@/db/workouts';

/** 指定した日('YYYY-MM-DD')のワークアウトを開く。その日の記録がなければ作成する。 */
export function useOpenWorkout() {
  const db = useSQLiteContext();
  return useCallback(
    async (date: string) => {
      const id = await findOrCreateWorkout(db, date);
      router.push({ pathname: '/workout/[id]', params: { id } });
    },
    [db]
  );
}
