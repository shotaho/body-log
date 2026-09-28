import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { BODY_PARTS, type BodyPart } from '@/db/migrations';
import { useTheme } from '@/hooks/use-theme';

const VIEW_W = 120;
const VIEW_H = 260;

type Levels = Record<BodyPart, number>;

/**
 * 前面・背面の全身イラスト。その日鍛えた部位を、ボリュームの段階(0〜4)に応じた濃さで塗る。
 * 部位は種目マスタの区分(胸・背中・脚・肩・腕・腹)。「その他」はイラストに出さない。
 */
export function BodyMap({ levels }: { levels: Levels }) {
  const theme = useTheme();
  const ramp = [theme.bodyIdle, theme.body1, theme.body2, theme.body3, theme.body4];
  const fill = (part: BodyPart) => ramp[levels[part]] ?? theme.bodyIdle;
  const neutral = theme.bodyIdle;
  const trained = (Object.keys(levels) as BodyPart[]).filter((p) => p !== 'other' && levels[p] > 0);

  return (
    <View
      accessible
      accessibilityLabel={`全身イラスト。鍛えた部位: ${
        trained.length > 0 ? trained.map((p) => BODY_PARTS[p]).join('、') : 'なし'
      }`}>
      <View style={styles.figures}>
        <Figure label="前">
          <Circle cx={60} cy={22} r={16} fill={neutral} />
          <Rect x={54} y={38} width={12} height={8} fill={neutral} />
          {/* 肩 */}
          <Ellipse cx={30} cy={58} rx={12} ry={10} fill={fill('shoulders')} />
          <Ellipse cx={90} cy={58} rx={12} ry={10} fill={fill('shoulders')} />
          {/* 胸 */}
          <Rect x={36} y={48} width={23} height={28} rx={7} fill={fill('chest')} />
          <Rect x={61} y={48} width={23} height={28} rx={7} fill={fill('chest')} />
          {/* 腹 */}
          <Rect x={42} y={80} width={36} height={44} rx={7} fill={fill('abs')} />
          {/* 腕(上腕・前腕) */}
          <Arms fill={fill('arms')} />
          {/* 腰 */}
          <Rect x={40} y={127} width={40} height={17} rx={6} fill={neutral} />
          {/* 脚(太もも・すね) */}
          <Legs fill={fill('legs')} />
        </Figure>
        <Figure label="後ろ">
          <Circle cx={60} cy={22} r={16} fill={neutral} />
          <Rect x={54} y={38} width={12} height={8} fill={neutral} />
          <Ellipse cx={30} cy={58} rx={12} ry={10} fill={fill('shoulders')} />
          <Ellipse cx={90} cy={58} rx={12} ry={10} fill={fill('shoulders')} />
          {/* 背中(上背部・広背筋・腰) */}
          <Path d="M38 48 H82 L78 100 H42 Z" fill={fill('back')} />
          <Rect x={42} y={103} width={36} height={21} rx={6} fill={fill('back')} />
          <Arms fill={fill('arms')} />
          {/* お尻(脚の区分) */}
          <Ellipse cx={50} cy={136} rx={11} ry={10} fill={fill('legs')} />
          <Ellipse cx={70} cy={136} rx={11} ry={10} fill={fill('legs')} />
          <Legs fill={fill('legs')} />
        </Figure>
      </View>
      <View style={styles.legend}>
        <LegendSwatch color={neutral} label="未実施" />
        <ThemedText type="small" themeColor="textSecondary">
          少
        </ThemedText>
        {ramp.slice(1).map((c) => (
          <View key={c} style={[styles.swatch, { backgroundColor: c }]} />
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          多
        </ThemedText>
      </View>
    </View>
  );
}

function Arms({ fill }: { fill: string }) {
  return (
    <>
      <Rect x={14} y={68} width={14} height={40} rx={6} fill={fill} />
      <Rect x={92} y={68} width={14} height={40} rx={6} fill={fill} />
      <Rect x={10} y={111} width={13} height={38} rx={6} fill={fill} />
      <Rect x={97} y={111} width={13} height={38} rx={6} fill={fill} />
    </>
  );
}

function Legs({ fill }: { fill: string }) {
  return (
    <>
      <Rect x={40} y={147} width={18} height={58} rx={8} fill={fill} />
      <Rect x={62} y={147} width={18} height={58} rx={8} fill={fill} />
      <Rect x={42} y={208} width={14} height={46} rx={7} fill={fill} />
      <Rect x={64} y={208} width={14} height={46} rx={7} fill={fill} />
    </>
  );
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.figure}>
      <Svg width="100%" height={200} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        {children}
      </Svg>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  figures: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  figure: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginRight: Spacing.three,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
});
