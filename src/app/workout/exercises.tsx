import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { ExerciseSectionList } from '@/components/exercise-section-list';
import { listExercises, type Exercise } from '@/db/workouts';

export default function ExercisesScreen() {
  const db = useSQLiteContext();
  const [exercises, setExercises] = useState<Exercise[]>([]);

  useFocusEffect(
    useCallback(() => {
      listExercises(db).then(setExercises);
    }, [db])
  );

  return (
    <ExerciseSectionList
      exercises={exercises}
      onPress={(e) => router.push({ pathname: '/workout/exercise/[id]', params: { id: e.id } })}
    />
  );
}
