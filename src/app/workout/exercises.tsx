import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { ExerciseSectionList } from '@/components/exercise-section-list';
import { TextField } from '@/components/text-field';
import { listExercises, listRecentExerciseIds, type Exercise } from '@/db/workouts';

export default function ExercisesScreen() {
  const db = useSQLiteContext();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [recentIds, setRecentIds] = useState<number[]>([]);
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      listExercises(db).then(setExercises);
      listRecentExerciseIds(db, 20).then(setRecentIds);
    }, [db])
  );

  return (
    <ExerciseSectionList
      exercises={exercises}
      recentIds={recentIds}
      query={query}
      header={
        <TextField
          label="種目名で検索"
          value={query}
          onChangeText={setQuery}
          placeholder="例: レッグプレス"
        />
      }
      onPress={(e) => router.push({ pathname: '/workout/exercise/[id]', params: { id: e.id } })}
    />
  );
}
