import { Stack } from 'expo-router';

export default function WorkoutLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: '筋トレ' }} />
    </Stack>
  );
}
