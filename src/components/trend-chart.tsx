import { useMemo, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { format1 } from '@/lib/decimal';
import { niceTicks, type DailyPoint } from '@/lib/weight-stats';

const HEIGHT = 200;
const PAD = { top: 8, right: 12, bottom: 22, left: 40 };
const DAY_MS = 24 * 60 * 60 * 1000;
/** これ以下の点数なら日ごとの値を点で描く。多いときは細線のみ。 */
const MAX_DOTS = 45;

type Props = {
  /** 日ごとの値(控えめに表示) */
  daily: DailyPoint[];
  /** 7日移動平均(主系列) */
  average: DailyPoint[];
  unit: string;
  /** 表示期間の開始・終了(ローカル 0:00 のエポックミリ秒) */
  from: number;
  to: number;
};

const shortDate = (time: number) => {
  const d = new Date(time);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

/**
 * 1軸の推移グラフ。日ごとの値をグレー、7日平均を青の 2px 線で描く。
 * タッチ(ドラッグ)で最も近い日を選び、十字線とツールチップで値を表示する。
 */
export function TrendChart({ daily, average, unit, from, to }: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const layout = useMemo(() => {
    if (width === 0 || daily.length === 0) {
      return null;
    }
    const values = [...daily, ...average].map((p) => p.value);
    const ticks = niceTicks(Math.min(...values), Math.max(...values));
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    // 1日分しか範囲がない場合も点が端に張り付かないよう前後半日の余白を取る
    const xMin = from - DAY_MS / 2;
    const xMax = to + DAY_MS / 2;
    const plotW = width - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const x = (t: number) => PAD.left + ((t - xMin) / (xMax - xMin)) * plotW;
    const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;
    const path = (points: DailyPoint[]) =>
      points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.time)},${y(p.value)}`).join(' ');
    return {
      ticks,
      x,
      y,
      dailyPath: path(daily),
      averagePath: path(average),
      xLabels: [from, from + (to - from) / 2, to].map((t) => ({ t, label: shortDate(t) })),
    };
  }, [width, daily, average, from, to]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const selectAt = (e: GestureResponderEvent) => {
    if (!layout) {
      return;
    }
    const touchX = e.nativeEvent.locationX;
    let nearest = 0;
    for (let i = 1; i < daily.length; i++) {
      if (
        Math.abs(layout.x(daily[i].time) - touchX) <
        Math.abs(layout.x(daily[nearest].time) - touchX)
      ) {
        nearest = i;
      }
    }
    setSelected(nearest);
  };

  const selectedIndex = selected != null && selected < daily.length ? selected : null;
  const selectedPoint = selectedIndex != null ? daily[selectedIndex] : null;
  const selectedAverage = selectedIndex != null ? average[selectedIndex] : null;

  return (
    <View>
      <View style={styles.legend}>
        <LegendKey color={theme.chartSeries} label="7日平均" line />
        <LegendKey color={theme.chartMuted} label="日ごとの値" />
      </View>

      <View
        style={styles.plot}
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onResponderGrant={selectAt}
        onResponderMove={selectAt}
        onResponderTerminationRequest={() => false}
        accessibilityLabel={`推移グラフ(${unit})`}>
        {/* 描画レイヤーはタッチを受けない。locationX を常に plot 基準にするため */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {layout && (
            <Svg width={width} height={HEIGHT}>
              {layout.ticks.map((t) => (
                <Line
                  key={t}
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={layout.y(t)}
                  y2={layout.y(t)}
                  stroke={theme.border}
                  strokeWidth={1}
                />
              ))}

              <Path
                d={layout.dailyPath}
                stroke={theme.chartMuted}
                strokeWidth={1}
                fill="none"
                strokeLinejoin="round"
              />
              {daily.length <= MAX_DOTS &&
                daily.map((p) => (
                  <Circle
                    key={p.date}
                    cx={layout.x(p.time)}
                    cy={layout.y(p.value)}
                    r={4}
                    fill={theme.chartMuted}
                    stroke={theme.backgroundElement}
                    strokeWidth={2}
                  />
                ))}

              <Path
                d={layout.averagePath}
                stroke={theme.chartSeries}
                strokeWidth={2}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {selectedPoint && selectedAverage && (
                <>
                  <Line
                    x1={layout.x(selectedPoint.time)}
                    x2={layout.x(selectedPoint.time)}
                    y1={PAD.top}
                    y2={HEIGHT - PAD.bottom}
                    stroke={theme.textSecondary}
                    strokeWidth={1}
                  />
                  <Circle
                    cx={layout.x(selectedPoint.time)}
                    cy={layout.y(selectedPoint.value)}
                    r={5}
                    fill={theme.chartMuted}
                    stroke={theme.backgroundElement}
                    strokeWidth={2}
                  />
                  <Circle
                    cx={layout.x(selectedAverage.time)}
                    cy={layout.y(selectedAverage.value)}
                    r={5}
                    fill={theme.chartSeries}
                    stroke={theme.backgroundElement}
                    strokeWidth={2}
                  />
                </>
              )}
            </Svg>
          )}

          {layout &&
            layout.ticks.map((t) => (
              <ThemedText
                key={t}
                type="small"
                themeColor="textSecondary"
                style={[styles.yLabel, { top: layout.y(t) - 10 }]}>
                {Number.isInteger(t) ? t : format1(t)}
              </ThemedText>
            ))}
          {layout &&
            layout.xLabels.map(({ t, label }, i) => (
              <ThemedText
                key={i}
                type="small"
                themeColor="textSecondary"
                style={[
                  styles.xLabel,
                  i === 0 && { left: PAD.left },
                  i === 1 && { left: layout.x(t) - 20, width: 40, textAlign: 'center' },
                  i === 2 && { right: PAD.right },
                ]}>
                {label}
              </ThemedText>
            ))}

          {layout && selectedPoint && selectedAverage && (
            <View
              style={[
                styles.tooltip,
                { backgroundColor: theme.background, borderColor: theme.border },
                layout.x(selectedPoint.time) > width / 2
                  ? { right: width - layout.x(selectedPoint.time) + Spacing.two }
                  : { left: layout.x(selectedPoint.time) + Spacing.two },
              ]}>
              <ThemedText type="smallBold">{shortDate(selectedPoint.time)}</ThemedText>
              <TooltipRow
                color={theme.chartMuted}
                label="値"
                value={`${format1(selectedPoint.value)} ${unit}`}
              />
              <TooltipRow
                color={theme.chartSeries}
                label="7日平均"
                value={`${format1(selectedAverage.value)} ${unit}`}
                line
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function LegendKey({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View
        style={
          line
            ? [styles.lineKey, { backgroundColor: color }]
            : [styles.dotKey, { backgroundColor: color }]
        }
      />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function TooltipRow({
  color,
  label,
  value,
  line,
}: {
  color: string;
  label: string;
  value: string;
  line?: boolean;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={
          line
            ? [styles.lineKey, { backgroundColor: color }]
            : [styles.dotKey, { backgroundColor: color }]
        }
      />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  lineKey: {
    width: 14,
    height: 2,
    borderRadius: 1,
  },
  dotKey: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  plot: {
    height: HEIGHT,
  },
  yLabel: {
    position: 'absolute',
    left: 0,
    width: PAD.left - Spacing.one,
    textAlign: 'right',
    fontSize: 11,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  xLabel: {
    position: 'absolute',
    bottom: 0,
    fontSize: 11,
    lineHeight: 16,
  },
  tooltip: {
    position: 'absolute',
    top: PAD.top,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    gap: Spacing.half,
  },
});
