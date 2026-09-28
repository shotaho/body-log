import { useState, type ReactElement } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';

import { Chips } from '@/components/chips';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { BODY_PARTS, type BodyPart } from '@/db/migrations';
import type { Exercise } from '@/db/workouts';
import { useTheme } from '@/hooks/use-theme';
import { buildExerciseSections, type ExerciseTab } from '@/lib/exercise-list';

const TAB_OPTIONS: { value: ExerciseTab; label: string }[] = [
  { value: 'all', label: 'すべて' },
  ...(Object.keys(BODY_PARTS) as BodyPart[]).map((value) => ({ value, label: BODY_PARTS[value] })),
];

/**
 * 種目リスト。部位タブで絞り込み、「すべて」では最近使った種目を先頭に出す。
 * 検索語(query)は親が持つ(種目の追加フォームと共有するため)。
 */
export function ExerciseSectionList({
  exercises,
  recentIds,
  query,
  onPress,
  header,
  bottomInset = BottomTabInset,
}: {
  exercises: Exercise[];
  recentIds: number[];
  query: string;
  onPress: (exercise: Exercise) => void;
  header?: ReactElement;
  bottomInset?: number;
}) {
  const theme = useTheme();
  const [tab, setTab] = useState<ExerciseTab>('all');
  const sections = buildExerciseSections(exercises, { recentIds, tab, query });

  return (
    <SectionList
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset + Spacing.three }]}
      keyboardShouldPersistTaps="handled"
      sections={sections}
      keyExtractor={(e, i) => `${e.id}-${i}`}
      ListHeaderComponent={
        <View style={styles.header}>
          {header}
          <Chips options={TAB_OPTIONS} value={tab} onChange={setTab} />
        </View>
      }
      ListEmptyComponent={
        <ThemedText themeColor="textSecondary" style={styles.empty}>
          該当する種目がありません
        </ThemedText>
      }
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
          {section.title}
        </ThemedText>
      )}
      ItemSeparatorComponent={() => (
        <View style={[styles.separator, { backgroundColor: theme.border }]} />
      )}
      renderItem={({ item, section }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => onPress(item)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <ThemedText style={styles.name}>{item.name}</ThemedText>
          {/* 「最近使った」では部位が混ざるので部位名を添える */}
          {section.key === 'recent' && (
            <ThemedText type="small" themeColor="textSecondary">
              {BODY_PARTS[item.bodyPart]}
            </ThemedText>
          )}
          <ThemedText themeColor="textSecondary">›</ThemedText>
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
  header: {
    gap: Spacing.three,
  },
  sectionHeader: {
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  name: {
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
  empty: {
    marginTop: Spacing.three,
  },
});
