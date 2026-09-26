import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function WorkoutScreen() {
  return (
    <Screen>
      <Card>
        <ThemedText themeColor="textSecondary">
          筋トレの記録(種目・セット入力、前回コピー)はステップ3で追加します。
        </ThemedText>
      </Card>
    </Screen>
  );
}
