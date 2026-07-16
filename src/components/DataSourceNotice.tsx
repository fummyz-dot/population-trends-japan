import type { PopulationMetadata } from '../types/population'
import { formatDateTime } from '../utils/dateTime'

interface DataSourceNoticeProps {
  metadata: PopulationMetadata
}

export function DataSourceNotice({ metadata }: DataSourceNoticeProps) {
  return (
    <section className="source-panel" aria-labelledby="source-heading">
      <div className="source-icon" aria-hidden="true">i</div>
      <div>
        <h2 id="source-heading">出典とデータについて</h2>
        <p>
          出典：総務省統計局「人口推計」。政府統計の総合窓口（e-Stat）APIを利用し、
          各年10月1日現在の男女計・総人口を本サイトで抽出、計算、可視化しています。
        </p>
        <ul>
          <li>元データは千人単位で、公表精度は1,000人です。</li>
          <li>2016～2019年は国勢調査結果による補間補正人口です。</li>
          <li>2015年と2020年は国勢調査を基にした接続年です。</li>
          <li>2021年以降は令和2年国勢調査基準の人口推計です。</li>
        </ul>
        <dl className="source-meta">
          <div>
            <dt>データ生成日時</dt>
            <dd>
              <time aria-label="データ生成日時" dateTime={metadata.generatedAt}>
                {formatDateTime(metadata.generatedAt)}（JST）
              </time>
            </dd>
          </div>
          <div><dt>統計表ID</dt><dd>{metadata.statsDataIds.map((id) => <code key={id}>{id}</code>)}</dd></div>
        </dl>
      </div>
    </section>
  )
}
