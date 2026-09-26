import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { BodyRecordForm } from '@/components/body-record-form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import {
  deleteBodyRecord,
  getBodyRecord,
  updateBodyRecord,
  type BodyRecord,
} from '@/db/body-records';

export default function EditBodyRecordScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recordId = Number(id);
  // undefined: 読み込み中 / null: 見つからない
  const [record, setRecord] = useState<BodyRecord | null>();

  useEffect(() => {
    getBodyRecord(db, recordId).then(setRecord);
  }, [db, recordId]);

  if (record === undefined) {
    return null;
  }
  if (record === null) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">記録が見つかりません</ThemedText>
      </Screen>
    );
  }

  return (
    <BodyRecordForm
      initial={record}
      onSubmit={async (input) => {
        await updateBodyRecord(db, recordId, input);
        router.back();
      }}
      onDelete={async () => {
        await deleteBodyRecord(db, recordId);
        router.back();
      }}
    />
  );
}
