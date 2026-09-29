import { StackActions } from 'expo-router/react-navigation';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const colors = useTheme();

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>ホーム</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="weight">
        <NativeTabs.Trigger.Label>体重</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="scalemass.fill" md="monitor_weight" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="workout"
        listeners={({ navigation, route }) => ({
          // 筋トレタブを押したら、記録画面などが開いたままでも履歴(一覧)に戻す
          tabPress: () => {
            const stack = (route as { state?: { key?: string; index?: number } }).state;
            if (stack?.key && stack.index) {
              navigation.dispatch({ ...StackActions.popToTop(), target: stack.key });
            }
          },
        })}>
        <NativeTabs.Trigger.Label>筋トレ</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="dumbbell.fill" md="fitness_center" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>設定</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
