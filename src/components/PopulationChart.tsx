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
import type { MetricType, PopulationMetricRecord, PrefectureCode } from '../types/population'
import {
  PREFECTURES,
  formatMetricValue,
  metricUnit,
  metricValue,
} from '../utils/populationMetrics'

interface PopulationChartProps {
  records: PopulationMetricRecord[]
  selected: PrefectureCode[]
  metric: MetricType
}

export function PopulationChart({ records, selected, metric }: PopulationChartProps) {
  const years = [...new Set(records.map((record) => record.year))].sort((a, b) => a - b)
  const data = years.map((year) => {
    const point: Record<string, number | null> = { year }
    for (const code of selected) {
      const record = records.find(
        (item) => item.year === year && item.prefectureCode === code,
      )
      point[code] = record ? metricValue(record, metric) : null
    }
    return point
  })

  const metricLabel =
    metric === 'population'
      ? '人口実数'
      : metric === 'index'
        ? '2015年を100とした指数'
        : metric === 'annualChange'
          ? '前年からの人口増減数'
          : '前年からの人口増減率'

  return (
    <section className="panel chart-panel" aria-labelledby="chart-heading">
      <div className="panel-heading">
        <div>
          <p className="section-label">TREND</p>
          <h2 id="chart-heading">人口推移を比較</h2>
        </div>
        <span className="unit-badge">単位：{metricUnit(metric)}</span>
      </div>
      <div
        className="chart-container"
        role="img"
        aria-label={`${selected.length}都道府県の${metricLabel}を年別に示す折れ線グラフ`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 18, left: 12, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 6" stroke="var(--chart-grid)" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
              stroke="var(--border-strong)"
            />
            <YAxis
              width={metric === 'population' ? 78 : 62}
              tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
              stroke="var(--border-strong)"
              tickFormatter={(value: number) => {
                if (metric === 'population') return `${(value / 1_000_000).toFixed(1)}M`
                if (metric === 'annualChange') return `${value / 1_000}k`
                if (metric === 'annualChangeRate') return `${value.toFixed(1)}%`
                return value.toFixed(0)
              }}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                color: 'var(--text)',
              }}
              formatter={(value, name) => [
                formatMetricValue(Number(value), metric),
                PREFECTURES.find((item) => item.code === name)?.name ?? String(name),
              ]}
              labelFormatter={(label) => `${label}年`}
            />
            <Legend
              formatter={(value) => {
                const prefecture = PREFECTURES.find((item) => item.code === value)
                return prefecture ? `${prefecture.code} ${prefecture.name}` : value
              }}
            />
            {selected.map((code) => {
              const prefecture = PREFECTURES.find((item) => item.code === code)!
              return (
                <Line
                  key={code}
                  type="monotone"
                  dataKey={code}
                  name={code}
                  stroke={prefecture.color}
                  strokeWidth={2.75}
                  dot={{ r: 2.5, strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-caption">
        元データは千人単位です。人口実数と前年差は、千人単位の原値を1,000倍して表示しています。
      </p>
    </section>
  )
}
