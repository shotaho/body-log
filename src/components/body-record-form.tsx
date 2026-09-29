import { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CompositionList } from '@/components/composition-list';
import { DateTimeField } from '@/components/date-time-field';
import { TextField } from '@/components/text-field';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import type { BodyRecord, BodyRecordInput } from '@/db/body-records';
import { parseBodyRecordForm } from '@/lib/body-record-form';
import { format1 } from '@/lib/decimal';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** 編集時の元データ。新規作成時は undefined */
  initial?: BodyRecord;
  /** 新規入力時のプレースホルダ(前回の体重) */
  placeholderWeightKg?: number;
  onSubmit: (input: BodyRecordInput) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function BodyRecordForm({ initial, placeholderWeightKg, onSubmit, onDelete }: Props) {
  const theme = useTheme();
  const [measuredAt, setMeasuredAt] = useState(() =>
    initial ? new Date(initial.measuredAt) : new Date()
  );
  const [weight, setWeight] = useState(initial ? format1(initial.weightKg) : '');
  const [bodyFat, setBodyFat] = useState(
    initial?.bodyFatPct != null ? format1(initial.bodyFatPct) : ''
  );
  const [note, setNote] = useState(initial?.note ?? '');
  const [errors, setErrors] = useState<{ weight?: string; bodyFat?: string }>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const result = parseBodyRecordForm({ weight, bodyFat, note });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSubmit({
        measuredAt: measuredAt.getTime(),
        weightKg: result.weightKg,
        bodyFatPct: result.bodyFatPct,
        note: result.note,
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!onDelete) {
      return;
    }
    Alert.alert('この記録を削除しますか?', undefined, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => onDelete() },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <DateTimeField value={measuredAt} onChange={setMeasuredAt} />
        <TextField
          label="体重"
          unit="kg"
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          placeholder={placeholderWeightKg != null ? format1(placeholderWeightKg) : '65.0'}
          autoFocus={!initial}
          error={errors.weight}
        />
        <TextField
          label="体脂肪率(任意)"
          unit="%"
          value={bodyFat}
          onChangeText={setBodyFat}
          keyboardType="decimal-pad"
          error={errors.bodyFat}
        />
        <TextField label="メモ(任意)" value={note} onChangeText={setNote} multiline />
        {initial?.source === 'scale' && (
          <Card title="体重計で計測した体組成">
            <CompositionList values={{ ...initial.composition, bodyFatPct: null }} />
          </Card>
        )}
        <Button title="保存" onPress={submit} disabled={saving} />
        {onDelete && <Button title="削除" variant="danger" onPress={confirmDelete} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
