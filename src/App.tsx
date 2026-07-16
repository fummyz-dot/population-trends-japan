import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PopulationData } from './types'

const lineColors = ['#087f8c', '#e85d3f', '#7357b2', '#d19a00', '#33845b']

function App() {
  const [data, setData] = useState<PopulationData | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadPopulationData() {
      try {
        const response = await fetch('/data/population.json', { signal: controller.signal })
        if (!response.ok) throw new Error('Failed to load population data')
        setData((await response.json()) as PopulationData)
      } catch (loadError) {
        if ((loadError as Error).name !== 'AbortError') setError(true)
      }
    }

    void loadPopulationData()
    return () => controller.abort()
  }, [])

  const chartData = useMemo(() => {
    if (!data) return []
    const { startYear, endYear } = data.metadata

    return Array.from({ length: endYear - startYear + 1 }, (_, index) => ({
      year: startYear + index,
      ...Object.fromEntries(
        data.prefectures.map((prefecture) => [prefecture.code, prefecture.values[index]]),
      ),
    }))
  }, [data])

  return (
    <main>
      <header className="hero">
        <div className="hero__inner">
          <p className="eyebrow">POPULATION TRENDS IN JAPAN</p>
          <h1>都道府県人口推移</h1>
          <p className="lead">
            日本の人口の変化を、都道府県ごとに見やすく比較するためのサイトです。
            現在は5都道府県のサンプル画面を公開しています。
          </p>
        </div>
      </header>

      <section className="content" aria-labelledby="chart-heading">
        <div className="section-heading">
          <div>
            <p className="section-label">2015 — 2024</p>
            <h2 id="chart-heading">人口推移を比較</h2>
          </div>
          {data && <p className="unit">単位：{data.metadata.unit}</p>}
        </div>

        {data && (
          <>
            <ul className="prefecture-list" aria-label="対象都道府県">
              {data.prefectures.map((prefecture, index) => (
                <li key={prefecture.code}>
                  <span
                    className="color-dot"
                    style={{ backgroundColor: lineColors[index] }}
                    aria-hidden="true"
                  />
                  <span className="prefecture-code">{prefecture.code}</span>
                  {prefecture.name}
                </li>
              ))}
            </ul>

            <div
              className="chart-card"
              role="img"
              aria-label="2015年から2024年までの5都道府県の人口推移を示す折れ線グラフ"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 12, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 6" stroke="#dce4df" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} stroke="#66736d" />
                  <YAxis
                    width={55}
                    tick={{ fontSize: 12 }}
                    stroke="#66736d"
                    tickFormatter={(value: number) => value.toLocaleString('ja-JP')}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      `${Number(value).toLocaleString('ja-JP')} 千人`,
                      data.prefectures.find((item) => item.code === name)?.name ?? name,
                    ]}
                    labelFormatter={(label) => `${label}年`}
                  />
                  <Legend
                    formatter={(value) =>
                      data.prefectures.find((item) => item.code === value)?.name ?? value
                    }
                  />
                  {data.prefectures.map((prefecture, index) => (
                    <Line
                      key={prefecture.code}
                      type="monotone"
                      dataKey={prefecture.code}
                      stroke={lineColors[index]}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <aside className="notice" aria-label="データに関する注意">
              <span className="notice__mark" aria-hidden="true">!</span>
              <div>
                <strong>サンプルデータについて</strong>
                <p>{data.metadata.notice}</p>
              </div>
            </aside>
          </>
        )}

        {!data && !error && <p className="status">データを読み込んでいます…</p>}
        {error && (
          <p className="status status--error" role="alert">
            データを読み込めませんでした。時間をおいて再度お試しください。
          </p>
        )}
      </section>

      <footer><p>都道府県人口推移 — Prototype</p></footer>
    </main>
  )
}

export default App
