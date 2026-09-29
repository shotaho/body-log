import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Option<T extends string> = { value: T; label: string };

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { borderColor: theme.border }]} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && { backgroundColor: theme.primary }]}>
            <ThemedText type="smallBold" style={{ color: selected ? theme.onPrimary : theme.text }}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
