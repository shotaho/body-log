import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { BodyRecordForm } from '@/components/body-record-form';
import { insertBodyRecord } from '@/db/body-records';

export default function NewBodyRecordScreen() {
  const db = useSQLiteContext();
  const [lastWeightKg, setLastWeightKg] = useState<number>();

  useEffect(() => {
    db.getFirstAsync<{ weight_kg: number }>(
      'SELECT weight_kg FROM body_record ORDER BY measured_at DESC LIMIT 1'
    ).then((row) => setLastWeightKg(row?.weight_kg));
  }, [db]);

  return (
    <BodyRecordForm
      placeholderWeightKg={lastWeightKg}
      onSubmit={async (input) => {
        await insertBodyRecord(db, input);
        router.back();
      }}
    />
  );
}
