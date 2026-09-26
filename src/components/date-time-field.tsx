import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDateJa } from '@/lib/date';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 日付と時刻の入力。Android は日付・時刻をそれぞれネイティブのダイアログで選ぶ。
 * (iOS はインラインのピッカーを表示する)
 */
export function DateTimeField({
  value,
  onChange,
}: {
  value: Date;
  onChange: (date: Date) => void;
}) {
  const theme = useTheme();

  if (Platform.OS !== 'android') {
    return (
      <DateTimePicker
        value={value}
        mode="datetime"
        maximumDate={new Date()}
        onValueChange={(_, date) => onChange(date)}
      />
    );
  }

  const open = (mode: 'date' | 'time') =>
    DateTimePickerAndroid.open({
      value,
      mode,
      is24Hour: true,
      maximumDate: mode === 'date' ? new Date() : undefined,
      onValueChange: (_, date) => {
        // 日付・時刻のうち選んだ側だけを差し替える
        const next = new Date(value);
        if (mode === 'date') {
          next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
        } else {
          next.setHours(date.getHours(), date.getMinutes(), 0, 0);
        }
        onChange(next);
      },
    });

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="日付を選択"
        onPress={() => open('date')}
        style={[styles.button, { borderColor: theme.border, flex: 1 }]}>
        <ThemedText>{`${value.getFullYear()}年${formatDateJa(value)}`}</ThemedText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="時刻を選択"
        onPress={() => open('time')}
        style={[styles.button, { borderColor: theme.border }]}>
        <ThemedText>{`${pad(value.getHours())}:${pad(value.getMinutes())}`}</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
});
