import type { PopulationMetricRecord, PrefectureCode } from '../types/population'
import {
  PREFECTURES,
  createPopulationSummaries,
  signedNumber,
  signedRate,
} from '../utils/populationMetrics'

interface PopulationSummaryProps {
  records: PopulationMetricRecord[]
  selected: PrefectureCode[]
}

export function PopulationSummary({ records, selected }: PopulationSummaryProps) {
  const summaries = createPopulationSummaries(records, selected)

  return (
    <section aria-labelledby="summary-heading">
      <div className="section-heading compact-heading">
        <div>
          <p className="section-label">LATEST SNAPSHOT</p>
          <h2 id="summary-heading">最新年サマリー</h2>
        </div>
      </div>
      <div className="summary-grid">
        {summaries.map((summary) => {
          const color = PREFECTURES.find((item) => item.code === summary.prefectureCode)?.color
          return (
            <article className="summary-card" key={summary.prefectureCode}>
              <div className="summary-card__title">
                <span className="color-dot" style={{ backgroundColor: color }} aria-hidden="true" />
                <h3>{summary.prefecture}</h3>
                <span>{summary.latestYear}年</span>
              </div>
              <p className="summary-population">
                {summary.latestPopulation.toLocaleString('ja-JP')}
                <small>人</small>
              </p>
              <dl className="summary-stats">
                <div>
                  <dt>2015年比</dt>
                  <dd>{signedNumber(summary.totalChange)}人</dd>
                </div>
                <div>
                  <dt>期間増減率</dt>
                  <dd>{signedRate(summary.totalChangeRate)}</dd>
                </div>
                <div>
                  <dt>最新前年差</dt>
                  <dd>
                    {summary.latestAnnualChange === null
                      ? '—'
                      : `${signedNumber(summary.latestAnnualChange)}人`}
                  </dd>
                </div>
              </dl>
            </article>
          )
        })}
      </div>
    </section>
  )
}
