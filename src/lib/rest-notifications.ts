import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { restAlerts } from '@/lib/rest-timer';

/**
 * 画面オフ・バックグラウンドでもレストタイマーの音を鳴らすための通知。
 * タイマー開始・延長のたびに「残り10秒」「終了」の2件を予約し直す。
 * アプリ表示中はアプリ内の音で鳴らすので、通知は表示も音もしない(ハンドラで抑止)。
 */

const CHANNEL_ID = 'rest-timer';

let setUp = false;
let permitted: boolean | null = null;
let scheduledIds: string[] = [];

async function ensureSetUp(): Promise<boolean> {
  if (!setUp) {
    setUp = true;
    Notifications.setNotificationHandler({
      // アプリ表示中はアプリ内の音で鳴らすので、通知は出さない
      handleNotification: async () => ({
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'レストタイマー',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 300],
      });
    }
  }
  if (permitted === null) {
    const current = await Notifications.getPermissionsAsync();
    permitted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  }
  return permitted;
}

/** 予約・取り消しが同時に走って予約が残らないよう、順番に実行する */
let queue: Promise<void> = Promise.resolve();
function enqueue(task: () => Promise<void>): Promise<void> {
  queue = queue.then(task).catch(() => {
    // 通知が使えなくてもアプリ内の音で鳴るので、失敗は無視する
  });
  return queue;
}

export function cancelRestAlerts(): Promise<void> {
  return enqueue(cancelNow);
}

export function scheduleRestAlerts(endAt: number): Promise<void> {
  return enqueue(() => scheduleNow(endAt));
}

async function cancelNow(): Promise<void> {
  const ids = scheduledIds;
  scheduledIds = [];
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

async function scheduleNow(endAt: number): Promise<void> {
  await cancelNow();
  if (!(await ensureSetUp())) {
    return;
  }
  const ids = await Promise.all(
    restAlerts(endAt, Date.now()).map((alert) =>
      Notifications.scheduleNotificationAsync({
        content: {
          title: alert.kind === 'end' ? 'レスト終了' : 'レスト残り10秒',
          body: alert.kind === 'end' ? '次のセットを始めましょう' : 'まもなく次のセットです',
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: alert.at,
          channelId: CHANNEL_ID,
        },
      })
    )
  );
  scheduledIds = ids;
}
