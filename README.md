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
├── components/     共通 UI コンポーネント
├── constants/      テーマカラーなど
├── db/             SQLite スキーマ・マイグレーション・クエリ
├── hooks/
├── lib/            日付・数値(小数点第1位丸め)などの純粋関数
└── theme/          テーマ設定(システム/ライト/ダーク)
```
