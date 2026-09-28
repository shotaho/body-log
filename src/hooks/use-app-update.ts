import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { Alert } from 'react-native';

/**
 * 起動時に OTA 更新を確認し、あればダウンロードして再起動するか尋ねる。
 * (何もしなくても次回起動時には適用されるが、すぐ反映できるようにする)
 * 開発中(expo start)や更新が無効なビルドでは何もしない。
 */
export function useAppUpdate() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) {
      return;
    }
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable) {
          return;
        }
        const fetched = await Updates.fetchUpdateAsync();
        if (!fetched.isNew) {
          return;
        }
        Alert.alert('アプリを更新しました', '再起動すると新しいバージョンになります。', [
          { text: 'あとで', style: 'cancel' },
          { text: '再起動', onPress: () => Updates.reloadAsync() },
        ]);
      } catch {
        // オフラインなどで確認できなくてもアプリはそのまま使える
      }
    })();
  }, []);
}
