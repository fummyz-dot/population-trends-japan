import type { PopulationMetricRecord, PrefectureCode } from '../types/population'
import { PREFECTURES } from './populationMetrics'

export const CSV_HEADERS = [
  'year',
  'prefecture_code',
  'estat_area_code',
  'prefecture',
  'population_thousand',
  'population',
  'change_from_previous_year',
  'change_rate_from_previous_year',
  'index_2015',
  'source_stats_data_id',
  'series_type',
] as const

const UTF8_BOM = '\uFEFF'
const CRLF = '\r\n'
const prefectureOrder = new Map(
  PREFECTURES.map((prefecture, index) => [prefecture.code, index]),
)

type CsvValue = string | number | null | undefined

export function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function formatDecimal(value: number | null): string {
  if (value === null) return ''
  return value.toFixed(4).replace(/\.?0+$/, '')
}

function recordToRow(record: PopulationMetricRecord): CsvValue[] {
  return [
    record.year,
    record.prefectureCode,
    record.estatAreaCode,
    record.prefecture,
    record.populationThousand,
    record.population,
    record.annualChange,
    formatDecimal(record.annualChangeRate),
    formatDecimal(record.index),
    record.sourceStatsDataId,
    record.seriesType,
  ]
}

export function generatePopulationCsv(
  records: PopulationMetricRecord[],
  selected: PrefectureCode[],
  toYear: number,
): string {
  const selectedCodes = new Set(selected)
  const rows = records
    .filter(
      (record) =>
        selectedCodes.has(record.prefectureCode) && record.year >= 2015 && record.year <= toYear,
    )
    .sort(
      (a, b) =>
        a.year - b.year ||
        (prefectureOrder.get(a.prefectureCode) ?? Number.MAX_SAFE_INTEGER) -
          (prefectureOrder.get(b.prefectureCode) ?? Number.MAX_SAFE_INTEGER),
    )
    .map((record) => recordToRow(record).map(escapeCsvValue).join(','))

  return `${UTF8_BOM}${CSV_HEADERS.join(',')}${CRLF}${rows.join(CRLF)}${CRLF}`
}

export function createPopulationCsvFilename(toYear: number, selected: PrefectureCode[]): string {
  const selectedSet = new Set(selected)
  const orderedCodes = PREFECTURES.map((prefecture) => prefecture.code).filter((code) =>
    selectedSet.has(code),
  )
  const suffix = orderedCodes.length === PREFECTURES.length ? 'all' : orderedCodes.join('-')
  return `population-trends-2015-${toYear}-${suffix}.csv`
}
