import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

// ホームのカレンダーなど他のタブから詳細画面を直接開いたときも、戻る先に一覧があるようにする
export const unstable_settings = { initialRouteName: 'index' };

export default function WeightLayout() {
  const theme = useTheme();
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: '体重',
          headerRight: () => (
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="体重計で測る"
                hitSlop={12}
                onPress={() => router.push('/weight/scale')}>
                <MaterialIcons name="bluetooth" size={26} color={theme.text} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="体重を手入力で記録"
                hitSlop={12}
                onPress={() => router.push('/weight/new')}>
                <MaterialIcons name="add" size={28} color={theme.text} />
              </Pressable>
            </View>
          ),
        }}
      />
      <Stack.Screen name="new" options={{ title: '体重を記録' }} />
      <Stack.Screen name="[id]" options={{ title: '記録を編集' }} />
      <Stack.Screen name="scale" options={{ title: '体重計で測る' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
});
