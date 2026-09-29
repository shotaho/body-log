import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { KeypadKey } from '@/lib/keypad';

const ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'back'],
];

const STEPS = [-5, -2.5, 2.5, 5];

const keyLabel = (key: KeypadKey) => (key === '.' ? '小数点' : key === 'back' ? '削除' : key);

type Props = {
  onKey: (key: KeypadKey) => void;
  /** 重量入力のときだけ ±5kg / ±2.5kg ボタンを出す */
  onStep?: (delta: number) => void;
  /** 小数点キーを使えるか(回数入力では無効) */
  decimal: boolean;
  onClose: () => void;
};

/** OS のキーボードを使わないアプリ内テンキー。 */
export function NumericKeypad({ onKey, onStep, decimal, onClose }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {onStep && (
        <View style={styles.row}>
          {STEPS.map((delta) => (
            <KeyButton
              key={delta}
              label={`${delta > 0 ? '+' : '−'}${Math.abs(delta)}kg`}
              onPress={() => onStep(delta)}
              tone="step"
            />
          ))}
        </View>
      )}
      {ROWS.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((key) =>
            key === 'back' ? (
              <KeyButton key={key} label={keyLabel(key)} onPress={() => onKey(key)}>
                <MaterialIcons name="backspace" size={22} color={theme.text} />
              </KeyButton>
            ) : (
              <KeyButton
                key={key}
                label={keyLabel(key)}
                onPress={() => onKey(key)}
                disabled={key === '.' && !decimal}>
                <ThemedText style={styles.keyText}>{key}</ThemedText>
              </KeyButton>
            )
          )}
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="テンキーを閉じる"
        onPress={onClose}
        style={styles.close}>
        <ThemedText type="small" themeColor="textSecondary">
          閉じる
        </ThemedText>
      </Pressable>
    </View>
  );
}

function KeyButton({
  label,
  onPress,
  disabled,
  tone,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'step';
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.key,
        {
          backgroundColor: tone === 'step' ? theme.backgroundSelected : theme.background,
          borderColor: theme.border,
        },
        (pressed || disabled) && styles.dimmed,
      ]}>
      {children ?? <ThemedText type="smallBold">{label}</ThemedText>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  key: {
    flex: 1,
    height: 48,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 600,
  },
  dimmed: {
    opacity: 0.4,
  },
  close: {
    alignSelf: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
});
