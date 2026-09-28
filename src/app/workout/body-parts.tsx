import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';

import { Card } from '@/components/card';
import { Chips } from '@/components/chips';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { TrendChart } from '@/components/trend-chart';
import { BODY_PARTS, type BodyPart } from '@/db/migrations';
import { listBodyPartDailyVolume, type BodyPartVolume } from '@/db/workouts';
import { BODY_PART_KEYS } from '@/lib/body-map';
import { fromLocalDateString, startOfDay } from '@/lib/date';

const OPTIONS = BODY_PART_KEYS.map((value) => ({ value, label: BODY_PARTS[value] }));
const formatInteger = (v: number) => Math.round(v).toLocaleString('ja-JP');

/** 部位ごとの総ボリューム(重量×回数の合計)の推移。 */
export default function BodyPartProgressScreen() {
  const db = useSQLiteContext();
  const [rows, setRows] = useState<BodyPartVolume[] | null>(null);
  const [part, setPart] = useState<BodyPart>('chest');

  useFocusEffect(
    useCallback(() => {
      listBodyPartDailyVolume(db).then(setRows);
    }, [db])
  );

  const points = useMemo(
    () =>
      (rows ?? [])
        .filter((r) => r.bodyPart === part)
        .map((r) => ({
          date: r.date,
          time: fromLocalDateString(r.date).getTime(),
          value: r.volumeKg,
        })),
    [rows, part]
  );

  if (rows === null) {
    return null;
  }

  return (
    <Screen>
      <Chips options={OPTIONS} value={part} onChange={setPart} />
      <Card title={`${BODY_PARTS[part]}の総ボリューム(kg)`}>
        {points.length > 0 ? (
          <TrendChart
            key={part}
            daily={points}
            unit="kg"
            formatValue={formatInteger}
            from={points[0].time}
            to={Math.max(points[points.length - 1].time, startOfDay(new Date()).getTime())}
          />
        ) : (
          <ThemedText themeColor="textSecondary">この部位の記録はまだありません</ThemedText>
        )}
      </Card>
      <ThemedText type="small" themeColor="textSecondary">
        その日に行ったこの部位の種目の「重量 × 回数」の合計です。
      </ThemedText>
    </Screen>
  );
}
