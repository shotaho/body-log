import { Pressable, StyleSheet, View } from 'react-native';

import { useRestTimer } from '@/components/rest-timer-provider';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/rest-timer';

/** ワークアウト画面の上部に出すレストタイマー。タイマーがなければ何も表示しない。 */
export function RestTimerBar() {
  const theme = useTheme();
  const { timer, remaining, skip, adjust, dismiss } = useRestTimer();
  if (!timer) {
    return null;
  }
  const running = timer.skippedAt == null && remaining > 0;
  const total = Math.max(1, (timer.endAt - timer.startedAt) / 1000);
  const progress = running ? remaining / total : 0;

  return (
    <View
      style={[styles.bar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
      accessibilityLiveRegion="polite">
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[styles.fill, { backgroundColor: theme.primary, width: `${progress * 100}%` }]}
        />
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>
          <ThemedText type="small" themeColor="textSecondary">
            {running ? 'レスト' : 'レスト終了'}
          </ThemedText>
          <ThemedText style={styles.time}>
            {running ? formatDuration(remaining) : '次のセットへ'}
          </ThemedText>
        </View>
        {running ? (
          <>
            <BarButton label="−15秒" onPress={() => adjust(-15)} />
            <BarButton label="+15秒" onPress={() => adjust(15)} />
            <BarButton label="スキップ" onPress={skip} />
          </>
        ) : (
          <BarButton label="閉じる" onPress={dismiss} />
        )}
      </View>
    </View>
  );
}

function BarButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        { borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  bar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  track: {
    height: 4,
    marginHorizontal: -Spacing.three,
  },
  fill: {
    height: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  time: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  button: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
});
