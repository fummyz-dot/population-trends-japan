import type {
  MetricType,
  PopulationMetricRecord,
  PopulationRecord,
  PopulationSummaryData,
  PrefectureCode,
} from '../types/population'

export const PREFECTURES: ReadonlyArray<{
  code: PrefectureCode
  name: string
  color: string
}> = [
  { code: '01', name: '北海道', color: '#168b98' },
  { code: '13', name: '東京都', color: '#e86649' },
  { code: '27', name: '大阪府', color: '#8068c5' },
  { code: '40', name: '福岡県', color: '#d49b12' },
  { code: '47', name: '沖縄県', color: '#3b9566' },
]

export const METRICS: ReadonlyArray<{
  type: MetricType
  label: string
  description: string
}> = [
  { type: 'population', label: '人口実数', description: '総人口（人）' },
  { type: 'index', label: '指数', description: '2015年＝100' },
  { type: 'annualChange', label: '前年差', description: '前年からの増減数' },
  { type: 'annualChangeRate', label: '前年比', description: '前年からの増減率' },
]

export function calculatePopulationMetrics(records: PopulationRecord[]): PopulationMetricRecord[] {
  const byPrefecture = new Map<PrefectureCode, PopulationRecord[]>()
  for (const record of records) {
    const list = byPrefecture.get(record.prefectureCode) ?? []
    list.push(record)
    byPrefecture.set(record.prefectureCode, list)
  }

  return [...byPrefecture.values()].flatMap((prefectureRecords) => {
    const sorted = [...prefectureRecords].sort((a, b) => a.year - b.year)
    const basePopulation = sorted.find((record) => record.year === 2015)?.population
    if (!basePopulation) throw new Error(`${sorted[0]?.prefecture ?? '不明'}の2015年データがありません`)

    return sorted.map((record, index) => {
      const previous = sorted[index - 1]
      const annualChange = previous ? record.population - previous.population : null
      return {
        ...record,
        index: (record.population / basePopulation) * 100,
        annualChange,
        annualChangeRate:
          previous && annualChange !== null ? (annualChange / previous.population) * 100 : null,
      }
    })
  })
}

export function metricValue(record: PopulationMetricRecord, metric: MetricType): number | null {
  if (metric === 'population') return record.population
  return record[metric]
}

export function createPopulationSummaries(
  records: PopulationMetricRecord[],
  selected: PrefectureCode[],
): PopulationSummaryData[] {
  return selected.map((prefectureCode) => {
    const prefectureRecords = records
      .filter((record) => record.prefectureCode === prefectureCode)
      .sort((a, b) => a.year - b.year)
    const first = prefectureRecords[0]
    const latest = prefectureRecords.at(-1)
    if (!first || !latest) throw new Error(`${prefectureCode}の人口データがありません`)
    const totalChange = latest.population - first.population
    return {
      prefectureCode,
      prefecture: latest.prefecture,
      latestYear: latest.year,
      latestPopulation: latest.population,
      totalChange,
      totalChangeRate: (totalChange / first.population) * 100,
      latestAnnualChange: latest.annualChange,
    }
  })
}

export function signedNumber(value: number) {
  const formatted = Math.abs(value).toLocaleString('ja-JP')
  if (value > 0) return `+${formatted}`
  if (value < 0) return `−${formatted}`
  return '0'
}

export function signedRate(value: number) {
  const formatted = Math.abs(value).toFixed(2)
  if (value > 0) return `+${formatted}%`
  if (value < 0) return `−${formatted}%`
  return '0.00%'
}

export function formatMetricValue(value: number | null, metric: MetricType) {
  if (value === null) return '—'
  if (metric === 'population') return `${value.toLocaleString('ja-JP')} 人`
  if (metric === 'index') return value.toFixed(2)
  if (metric === 'annualChange') return `${signedNumber(value)} 人`
  return signedRate(value)
}

export function metricUnit(metric: MetricType) {
  if (metric === 'population') return '人'
  if (metric === 'index') return '2015年＝100'
  if (metric === 'annualChange') return '人'
  return '%'
}
