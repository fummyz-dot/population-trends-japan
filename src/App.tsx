import { useMemo } from 'react'
import { DataSourceNotice } from './components/DataSourceNotice'
import { CsvDownloadButton } from './components/CsvDownloadButton'
import { MetricSelector } from './components/MetricSelector'
import { PopulationChart } from './components/PopulationChart'
import { PopulationSummary } from './components/PopulationSummary'
import { PopulationTable } from './components/PopulationTable'
import { PrefectureSelector } from './components/PrefectureSelector'
import { usePopulationData } from './hooks/usePopulationData'
import { useUrlState } from './hooks/useUrlState'
import { calculatePopulationMetrics } from './utils/populationMetrics'

function App() {
  const { data, loading, error } = usePopulationData()
  const { selectedPrefectures, metric, togglePrefecture, setMetric } = useUrlState()
  const metricRecords = useMemo(
    () => (data ? calculatePopulationMetrics(data.records) : []),
    [data],
  )

  return (
    <>
      <a className="skip-link" href="#main-content">メインコンテンツへ移動</a>
      <header className="hero">
        <div className="hero__inner">
          <p className="eyebrow">POPULATION TRENDS IN JAPAN</p>
          <h1>都道府県人口推移</h1>
          <p className="lead">
            総務省統計局の人口推計をもとに、5都道府県の2015年以降の人口変化を
            4つの指標で比較できます。
          </p>
          {data && (
            <p className="hero-period">
              {data.metadata.fromYear} — {data.metadata.toYear}
              <span>各年10月1日現在</span>
            </p>
          )}
        </div>
      </header>

      <main id="main-content" className="content" tabIndex={-1}>
        {loading && (
          <div className="status" role="status" aria-live="polite">
            <span className="status-spinner" aria-hidden="true" />
            <strong>人口データを読み込んでいます</strong>
            <p>しばらくお待ちください。</p>
          </div>
        )}

        {error && (
          <div className="status status--error" role="alert">
            <strong>データを表示できません</strong>
            <p>{error}</p>
          </div>
        )}

        {data && (
          <>
            <section className="controls-panel" aria-label="表示設定">
              <PrefectureSelector selected={selectedPrefectures} onToggle={togglePrefecture} />
              <MetricSelector metric={metric} onChange={setMetric} />
            </section>

            <PopulationChart
              records={metricRecords}
              selected={selectedPrefectures}
              metric={metric}
            />
            <PopulationSummary records={metricRecords} selected={selectedPrefectures} />
            <PopulationTable records={metricRecords} selected={selectedPrefectures} />
            <CsvDownloadButton
              metadata={data.metadata}
              records={metricRecords}
              selected={selectedPrefectures}
            />
            <DataSourceNotice metadata={data.metadata} />
          </>
        )}
      </main>

      <footer><p>都道府県人口推移 — Population data explorer</p></footer>
    </>
  )
}

export default App
