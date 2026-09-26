import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack } from 'expo-router';
import { Pressable } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export default function WeightLayout() {
  const theme = useTheme();
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: '体重',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="体重を記録"
              hitSlop={12}
              onPress={() => router.push('/weight/new')}>
              <MaterialIcons name="add" size={28} color={theme.text} />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="new" options={{ title: '体重を記録' }} />
      <Stack.Screen name="[id]" options={{ title: '記録を編集' }} />
    </Stack>
  );
}
