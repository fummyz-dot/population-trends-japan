# 都道府県人口推移

React、TypeScript、Vite で作成した都道府県人口推移サイトの初期版です。

## 起動方法

Node.js 24 以上と npm を使用します。`.nvmrc` を利用できる環境では、`nvm use`でバージョンを切り替えられます。

```bash
npm install
npm run dev
```

ブラウザで、ターミナルに表示されたローカル URL を開いてください。

## 人口データの更新

`.env` に `ESTAT_APP_ID` を設定して実行します。

```bash
npm run data:refresh
```

## CI

GitHub Actionsでは、mainブランチへのpush、Pull Request、手動実行時に次の検証を行います。

```bash
npm ci
npm run lint
npm test -- --run
npm run data:validate
npm run build
```

CIはリポジトリに保存済みの人口データを検証し、e-Stat APIへのアクセスやデータ更新、デプロイは行いません。
