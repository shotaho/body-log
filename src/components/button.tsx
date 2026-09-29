import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
};

export function Button({ title, onPress, variant = 'primary', disabled }: Props) {
  const theme = useTheme();
  const primary = variant === 'primary';
  // 枠線と文字の色(primary 以外)
  const accent = variant === 'danger' ? theme.danger : theme.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? { backgroundColor: theme.primary } : { borderWidth: 1, borderColor: accent },
        (pressed || disabled) && styles.dimmed,
      ]}>
      <ThemedText
        type="smallBold"
        style={[styles.label, { color: primary ? theme.onPrimary : accent }]}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
  },
  dimmed: {
    opacity: 0.6,
  },
});
