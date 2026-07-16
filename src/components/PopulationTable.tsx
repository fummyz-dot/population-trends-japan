import type { PopulationMetricRecord, PrefectureCode } from '../types/population'
import { signedNumber, signedRate } from '../utils/populationMetrics'

interface PopulationTableProps {
  records: PopulationMetricRecord[]
  selected: PrefectureCode[]
}

export function PopulationTable({ records, selected }: PopulationTableProps) {
  const visibleRecords = records
    .filter((record) => selected.includes(record.prefectureCode))
    .sort((a, b) => b.year - a.year || a.prefectureCode.localeCompare(b.prefectureCode))

  return (
    <section className="panel table-panel" aria-labelledby="table-heading">
      <div className="panel-heading">
        <div>
          <p className="section-label">DATA TABLE</p>
          <h2 id="table-heading">年次データ一覧</h2>
        </div>
        <span className="unit-badge">新しい年順</span>
      </div>
      <div className="table-scroll" tabIndex={0} aria-label="人口データ一覧（横スクロール可能）">
        <table>
          <thead>
            <tr>
              <th scope="col">年</th>
              <th scope="col">都道府県</th>
              <th scope="col">人口</th>
              <th scope="col">人口（千人）</th>
              <th scope="col">前年増減数</th>
              <th scope="col">前年増減率</th>
              <th scope="col">取得元統計表ID</th>
              <th scope="col">seriesType</th>
            </tr>
          </thead>
          <tbody>
            {visibleRecords.map((record) => (
              <tr key={`${record.year}-${record.prefectureCode}`}>
                <td>{record.year}</td>
                <th scope="row">{record.prefecture}</th>
                <td>{record.population.toLocaleString('ja-JP')}人</td>
                <td>{record.populationThousand.toLocaleString('ja-JP')}千人</td>
                <td>{record.annualChange === null ? '—' : `${signedNumber(record.annualChange)}人`}</td>
                <td>{record.annualChangeRate === null ? '—' : signedRate(record.annualChangeRate)}</td>
                <td><code>{record.sourceStatsDataId}</code></td>
                <td><code>{record.seriesType}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
