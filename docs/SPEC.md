# body-log 仕様書(ドラフト v0.2)

筋トレと体重・体組成を記録する個人向けAndroidアプリ。

## 1. 前提・方針

| 項目 | 決定内容 |
| --- | --- |
| 対象OS | Android(将来的にiOSも可能な構成にする) |
| 技術 | React Native + Expo(TypeScript)、Development Build を使用 |
| データ保存 | 端末内のみ(SQLite / `expo-sqlite`)。ログイン・サーバーなし |
| バックアップ | JSON エクスポート/インポート(機種変更時の移行用) |
| 体組成計連携 | Xiaomi 体組成計から Bluetooth(BLE)で直接受信 |
| 単位・精度 | kg / % とも小数点第1位まで(入力・表示・保存とも 0.1 単位で丸め) |
| 外観 | ライト/ダーク両対応。既定は端末のシステム設定に追従、設定画面で手動切替も可 |

> BLE 直接受信はネイティブモジュール(`react-native-ble-plx`)が必要なため、Expo Go では動かず Development Build(`expo run:android` / EAS Build)を使う。

## 2. 機能一覧

### 2.1 体重・体組成ログ
- 記録項目: 日時、体重(kg、0.1 単位)、体脂肪率(%)、その他体組成値(後述)、メモ、入力元(`manual` / `scale`)
- 1日複数回の記録を許可
- 手動入力も常に可能(体重計が使えないとき用)
- 一覧表示・編集・削除
- グラフ: 体重・体脂肪率の推移(週/月/年/全期間)、7日移動平均線

### 2.2 体組成計連携(BLE)
- 「計測」画面を開いている間、BLE スキャンを行い体重計のアドバタイズを受信
- 体重が「確定(stabilized)」したデータのみ採用
- 体組成計(インピーダンス対応機種)の場合、インピーダンスからアプリ側で体組成を算出
  - 算出にはプロフィール(身長・年齢・性別)が必要
  - 算出項目: 体脂肪率、筋肉量、体水分率、骨量、内臓脂肪レベル、BMI、基礎代謝
  - ※算出値は Xiaomi 公式アプリの値と多少ずれる可能性がある(許容済み)
- 受信した値を確認画面に表示 → 「保存」で記録
- 初回に使用する体重計を登録(MACアドレスで識別)し、他人の体重計を拾わないようにする
- 同一計測の重複保存防止(計測時刻が同一なら無視)

#### 対応機種の見込み

| 機種 | 型番 | 取得できる値 | 対応可否 |
| --- | --- | --- | --- |
| Mi Body Composition Scale 2 | XMTZC05HM | 体重 + インピーダンス | ◎ 暗号化なし |
| Mi Body Composition Scale | XMTZC02HM | 体重 + インピーダンス | ◎ 暗号化なし |
| Mi Smart Scale 2 | XMTZC04HM | 体重のみ | ○ 体組成なし |
| Xiaomi Body Composition Scale S400 | MJTZC01YM | 体重 + 体組成 | △ 暗号化あり。Xiaomi アカウントから取得する bindkey が必要で難易度高 |

→ **ユーザーの機種を確認のうえ確定する(未決事項 #1)**

### 2.3 筋トレログ
- 構造: ワークアウト(日付)→ 種目 → セット(重量 kg(0.1 単位)× 回数)
- 種目マスタ: プリセット(ベンチプレス、スクワット、デッドリフト等)+ ユーザー追加、部位タグ付き
- 入力時に同種目の前回記録を表示、「前回と同じ」でコピー
- 種目ごとの推移グラフ: 最大重量、推定1RM(Epley式: `重量 × (1 + 回数/30)`)、総ボリューム
- 自己ベスト(PR)更新時にバッジ表示

### 2.4 その他
- ホーム: 最新体重、前回比、今週のトレーニング回数
- カレンダー: トレーニング日・計測日をマーク
- 設定: プロフィール(身長・生年月日・性別)、体重計の登録/解除、テーマ(システム/ライト/ダーク)、データのエクスポート/インポート

## 3. 画面構成

```
タブ
├── ホーム(サマリ)
├── 体重
│   ├── 一覧 / グラフ
│   ├── 計測(BLE受信)
│   └── 手動入力
├── 筋トレ
│   ├── ワークアウト一覧
│   ├── ワークアウト記録(種目追加 → セット入力)
│   └── 種目詳細(推移グラフ・PR)
└── 設定
```

## 4. データモデル(SQLite)

```sql
app_setting    (key, value)                       -- テーマ設定など
profile        (id, height_cm, birth_date, sex)
scale_device   (id, mac_address, model, name, created_at)
body_record    (id, measured_at, weight_kg, body_fat_pct, muscle_kg, water_pct,
                bone_kg, visceral_fat, bmr_kcal, bmi, impedance, source, note)
exercise       (id, name, body_part, is_preset, archived)
workout        (id, date, note, created_at)
workout_set    (id, workout_id, exercise_id, set_order, weight_kg, reps)
```

- 日時(`measured_at`, `created_at`)は UNIX エポックミリ秒(INTEGER)、`workout.date` はローカル日付 `YYYY-MM-DD`
- スキーマ変更は `src/db/migrations.ts` の末尾にマイグレーションを追加する(`PRAGMA user_version` で管理)

## 5. 権限(Android)
- `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`(Android 12+)
- `ACCESS_FINE_LOCATION`(Android 11 以下の BLE スキャンに必要)

## 6. 開発ステップ
1. ✅ プロジェクト雛形(Expo + TypeScript + expo-router + expo-sqlite、タブ構成、DB スキーマ、テーマ切替)
2. 体重の手動記録・一覧・グラフ
3. 筋トレ記録(種目マスタ・セット入力・前回コピー)
4. BLE 受信(体重のみ)→ 体組成算出
5. エクスポート/インポート、ホーム・カレンダー

## 7. 未決事項
1. **体重計の機種**(本体裏のラベルの型番: XMTZC05HM / MJTZC01YM など)→ 後日連絡。BLE 実装(ステップ4)までに確定すればよい
2. アプリ名(仮: body-log)

## 8. 決定履歴
- v0.2: 単位は kg、小数点第1位まで / 体組成算出値のずれは許容 / ダークモード対応
