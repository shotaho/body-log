import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BodyMap } from '@/components/body-map';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { BODY_PARTS, type BodyPart } from '@/db/migrations';
import { getLastTrainedByBodyPart } from '@/db/workouts';
import { useTheme } from '@/hooks/use-theme';
import { BODY_PART_KEYS } from '@/lib/body-map';
import { toLocalDateString } from '@/lib/date';
import { fatigueLevel, recoveryByBodyPart, type Recovery } from '@/lib/recovery';

/** 回復にかかる最長の時間(72時間)より前の記録は見なくてよい */
const LOOKBACK_DAYS = 4;
/** イラストに出す部位(「その他」は除く) */
const PARTS = BODY_PART_KEYS.filter((p) => p !== 'other');

/** 部位ごとの回復状態(最後に鍛えてからの経過時間の目安)を全身イラストと一覧で表示する。 */
export function RecoveryCard() {
  const db = useSQLiteContext();
  const [recovery, setRecovery] = useState<Record<BodyPart, Recovery> | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const now = new Date();
      const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - LOOKBACK_DAYS);
      getLastTrainedByBodyPart(db, toLocalDateString(since)).then(
        (last) => active && setRecovery(recoveryByBodyPart(last, now.getTime()))
      );
      return () => {
        active = false;
      };
    }, [db])
  );

  if (!recovery) {
    return null;
  }

  const levels = Object.fromEntries(
    BODY_PART_KEYS.map((p) => [p, p === 'other' ? 0 : fatigueLevel(recovery[p].percent)])
  ) as Record<BodyPart, number>;
  const ready = PARTS.filter((p) => recovery[p].percent >= 100);

  return (
    <Card title="部位の回復状態">
      <BodyMap
        levels={levels}
        legend={{ idle: '回復済み', low: '回復中', high: '疲労' }}
        description="回復中の部位"
      />
      <ThemedText>
        {ready.length === PARTS.length
          ? 'すべての部位が回復しています'
          : ready.length > 0
            ? `今日のおすすめ: ${ready.map((p) => BODY_PARTS[p]).join('・')}`
            : 'すべての部位が回復中です。休養も大切です'}
      </ThemedText>
      <View style={styles.list}>
        {PARTS.map((p) => (
          <RecoveryRow key={p} label={BODY_PARTS[p]} recovery={recovery[p]} />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        最後に鍛えてからの時間による目安です(胸・肩・腕 48時間、背中・脚 72時間、腹 24時間)
      </ThemedText>
    </Card>
  );
}

function RecoveryRow({ label, recovery }: { label: string; recovery: Recovery }) {
  const theme = useTheme();
  const done = recovery.percent >= 100;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${label} ${done ? '回復済み' : `回復 ${recovery.percent}%、あと約${recovery.hoursLeft}時間`}`}>
      <ThemedText type="small" style={styles.label}>
        {label}
      </ThemedText>
      <View style={[styles.track, { backgroundColor: theme.bodyIdle }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${recovery.percent}%`,
              backgroundColor: done ? theme.chartMuted : theme.chartSeries,
            },
          ]}
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.value}>
        {done ? '回復済み' : `${recovery.percent}% · あと${recovery.hoursLeft}h`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  label: {
    width: 36,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  value: {
    width: 104,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
