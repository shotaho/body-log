import { Stack } from 'expo-router';

export default function WorkoutLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: '筋トレ' }} />
      <Stack.Screen name="[id]" options={{ title: 'ワークアウト' }} />
      <Stack.Screen name="exercises" options={{ title: '種目' }} />
      <Stack.Screen name="exercise/[id]" options={{ title: '種目' }} />
    </Stack>
  );
}
