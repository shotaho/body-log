import type { ReactElement } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { BODY_PARTS, type BodyPart } from '@/db/migrations';
import type { Exercise } from '@/db/workouts';
import { useTheme } from '@/hooks/use-theme';

/** 部位ごとに見出しを付けた種目リスト。 */
export function ExerciseSectionList({
  exercises,
  onPress,
  header,
  bottomInset = BottomTabInset,
}: {
  exercises: Exercise[];
  onPress: (exercise: Exercise) => void;
  header?: ReactElement;
  bottomInset?: number;
}) {
  const theme = useTheme();
  const sections = (Object.keys(BODY_PARTS) as BodyPart[])
    .map((part) => ({
      title: BODY_PARTS[part],
      data: exercises.filter((e) => e.bodyPart === part),
    }))
    .filter((s) => s.data.length > 0);

  return (
    <SectionList
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset + Spacing.three }]}
      keyboardShouldPersistTaps="handled"
      sections={sections}
      keyExtractor={(e) => String(e.id)}
      ListHeaderComponent={header}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
          {section.title}
        </ThemedText>
      )}
      ItemSeparatorComponent={() => (
        <View style={[styles.separator, { backgroundColor: theme.border }]} />
      )}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => onPress(item)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <ThemedText>{item.name}</ThemedText>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  sectionHeader: {
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  row: {
    paddingVertical: Spacing.three,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
});
