import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function WeightScreen() {
  return (
    <Screen>
      <Card>
        <ThemedText themeColor="textSecondary">
          体重の記録・一覧・グラフはステップ2で追加します。
        </ThemedText>
      </Card>
    </Screen>
  );
}
