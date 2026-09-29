import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 各タブ画面の共通コンテナ。スクロール可能で、下部タブバーに隠れないよう余白を取る。 */
export function Screen({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
