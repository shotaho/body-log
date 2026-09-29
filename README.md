# body-log

筋トレと体重・体組成を記録する個人向け Android アプリ(React Native + Expo)。

仕様は [docs/SPEC.md](docs/SPEC.md) を参照。

## 開発

```bash
npm install
npx expo run:android   # Development Build をビルドして実機/エミュレータで起動
```

`expo-sqlite` や今後追加する BLE などネイティブモジュールを使うため、Expo Go ではなく Development Build で動かす。
ローカルに Android Studio がない場合は `npx eas-cli@latest build --profile development --platform android` でクラウドビルドできる。

## 配布(EAS Workflows)

`claude/workout-weight-log-app-ceepeb` ブランチに push すると、Expo のサーバーで `.eas/workflows/preview.yml` が実行される(GitHub 連携済みのため、トークン不要)。

- ネイティブ部分(fingerprint)が変わっていなければ OTA 更新を `preview` チャンネルに配信する。アプリは起動時に更新を取得し、再起動を促す
- ネイティブ部分が変わっていれば APK(`eas.json` の `preview` プロファイル)を作り直す。expo.dev のビルド画面から端末にインストールする

## 音声ファイル

レストタイマーの音(`assets/sounds/*.wav`)は `node scripts/generate-beeps.mjs` で生成している。

## アイコン

アプリアイコン・スプラッシュ・favicon(`assets/images/`)は、元画像 `assets/source/icon-original.jpg` から `python3 scripts/generate-icons.py` で生成している(Pillow が必要)。

## チェック

```bash
npm run lint
npm run typecheck
npm test
```

## ディレクトリ構成

```
src/
├── app/            画面(expo-router のルート)。タブ: ホーム / 体重 / 筋トレ / 設定
├── ble/            体重計(Mi Body Composition Scale 2)の BLE スキャン
├── components/     共通 UI コンポーネント
├── constants/      テーマカラーなど
├── db/             SQLite スキーマ・マイグレーション・クエリ・バックアップ
│                   (テストは node:sqlite 上で実際の SQL を実行)
├── hooks/
├── lib/            日付・数値・集計・体重計データ解析・体組成計算などの純粋関数
└── theme/          テーマ設定(システム/ライト/ダーク)
```
