import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {title && (
        <ThemedText type="smallBold" themeColor="textSecondary">
          {title}
        </ThemedText>
      )}
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
});
