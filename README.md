# 都道府県人口推移

## 公開URL

https://population-trends.web-tools-jp.workers.dev/

## 概要

北海道・東京都・大阪府・福岡県・沖縄県の2015年以降の人口推移を比較するデータ可視化サイトです。総務省統計局「人口推計」をe-Stat APIから取得し、人口実数だけでなく指数・前年差・前年比をグラフと表で確認できます。

## 主な機能

- 5都道府県の複数選択・比較
- 人口実数の表示
- 2015年を100とした指数の表示
- 前年増減数・前年増減率の表示
- URLクエリによる選択状態の共有
- 選択中の都道府県データのCSVダウンロード
- モバイルを含むレスポンシブ表示
- OS設定に連動するダークモード

## 使用技術

- React / TypeScript
- Vite
- Recharts
- Vitest / React Testing Library
- Node.js
- e-Stat API
- GitHub Actions
- Cloudflare Workers Static Assets

## アーキテクチャ

```text
e-Stat API
  → Node.jsによる取得・正規化・検証
  → public/data/population.json
  → Reactによる静的表示
  → GitHub Actionsによる検証・ビルド
  → Cloudflare Workers Static Assets
```

ブラウザからe-Stat APIへ直接接続せず、検証済みJSONを静的アセットとして配信します。取得データに実質的な変更がない場合は既存JSONを置換せず、`metadata.generatedAt`だけのGit差分が発生しない構成です。

## データ出典

> 出典：総務省統計局「人口推計」
>
> 政府統計の総合窓口（e-Stat）APIを利用

- 元データの単位は千人です。
- `population`は千人単位の値を1,000倍した派生値です。
- サイト上の計算・加工・可視化は本リポジトリで実施しています。
- 最新収録年は現在2024年です。

## 系列接続方針

| 期間 | 取り扱い | 統計表ID |
| --- | --- | --- |
| 2015～2020年 | 令和2年国勢調査結果を基準とする系列。2016～2019年は補間補正人口、2015年と2020年は接続年 | `0004021102` |
| 2021～2024年 | 令和2年国勢調査基準の人口推計 | `0003448232` |

系列の出典は`metadata.seriesPolicy`と各レコードの`sourceStatsDataId`にも保存しています。2025年以降を追加する際は、統計表ID、時間コード、系列接続方法を再確認する必要があります。

## ローカル開発

Node.js 24以上とnpmを使用します。

```bash
npm ci
npm run dev
```

Viteが表示するローカルURLをブラウザで開いてください。本番ビルドの確認は次のコマンドで行えます。

```bash
npm run build
npm run preview
```

## npm scripts

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | Vite開発サーバーを起動 |
| `npm run build` | TypeScriptを検査し、本番アセットを`dist`へ生成 |
| `npm run preview` | 本番ビルドをローカル配信 |
| `npm run lint` | ESLintを実行 |
| `npm test -- --run` | Vitestの全テストを1回実行 |
| `npm run inspect:estat` | e-Statレスポンスの構造を調査 |
| `npm run data:fetch` | e-Statから人口データを取得・正規化・検証して更新 |
| `npm run data:validate` | 保存済み人口JSONを検証 |
| `npm run data:refresh` | データ取得後に保存済みJSONを再検証 |

## 環境変数

| 名前 | 用途 | 必須となる処理 |
| --- | --- | --- |
| `ESTAT_APP_ID` | e-Stat APIのアプリケーションID | `data:fetch` / `data:refresh` |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Workersへのデプロイ認証 | GitHub Actionsのdeploy job |
| `CLOUDFLARE_ACCOUNT_ID` | デプロイ先Cloudflareアカウントの指定 | GitHub Actionsのdeploy job |

ローカルのe-Stat認証情報は`.env`へ設定します。`.env`と各Secretの値はリポジトリへコミットしません。

## テスト

```bash
npm run lint
npm test -- --run
npm run data:validate
npm run build
```

日時表示、URL状態、人口指標計算、CSV生成、データ読込・検証、e-Statレスポンス変換、人口JSONの実質差分判定をテストしています。

## CI/CD

- `ci.yml`: mainへのpush、Pull Request、手動実行でlint・test・データ検証・buildを実施します。
- `refresh-data.yml`: 手動実行でe-Statデータを取得し、実質的な変更がある場合だけ固定ブランチを更新してPull Requestを作成します。
- `deploy.yml`: mainへのpushまたは手動実行で全検証とWrangler dry-runを行い、GitHubの`production` environmentを経由してCloudflare Workers Static Assetsへデプロイします。

データ更新Pull Requestの自動マージ・自動承認は行いません。

## ディレクトリ構成

```text
.
├── .github/workflows/       # CI、データ更新、デプロイ
├── public/                  # 人口JSON、favicon、robots、sitemap、headers
│   └── data/population.json
├── scripts/                 # e-Stat取得・正規化・検証
│   └── lib/                 # APIクライアント、schema、比較処理
├── src/
│   ├── components/          # グラフ、表、選択UI、CSV UI
│   ├── hooks/               # データ読込、URL状態
│   ├── services/            # ブラウザ側データ検証
│   ├── test/                # テストfixture・setup
│   └── utils/               # 指標計算、CSV、日時整形
├── index.html               # 静的メタデータとアプリentry
├── vite.config.ts           # Vite / Vitest設定
└── wrangler.jsonc           # Workers Static Assets設定
```

## 制約・今後の課題

- 対象は5都道府県、2015～2024年です。
- 2025年以降は統計表IDや時間コード、系列接続方法の再確認が必要です。
- Open Graph画像は未作成です。
- グラフ描画を含むJavaScript bundleにはサイズ警告があり、必要に応じて分割を検討します。
- 自動デプロイの実行にはGitHubの`production` environmentとCloudflare Secretsの設定が必要です。

## データ利用に関する表記

本サイトは、総務省統計局「人口推計」を基に、本リポジトリで抽出・計算・加工・可視化したものです。政府統計の総合窓口（e-Stat）APIを利用しています。国が本サイトの内容を作成・保証しているものではありません。

統計局コンテンツの利用に当たっては、[総務省統計局「サイトの利用について」](https://www.stat.go.jp/info/riyou.html)および同ページが示す公共データ利用規約に従います。
