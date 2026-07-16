export type PrefectureCode = '01' | '13' | '27' | '40' | '47'

export type MetricType = 'population' | 'index' | 'annualChange' | 'annualChangeRate'

export type SeriesType = 'census-anchor' | 'interpolated-adjusted' | 'population-estimate'

export interface SeriesPolicy {
  fromYear: number
  toYear: number
  statsDataId: string
}

export interface PopulationMetadata {
  title: string
  source: string
  api: string
  referenceDate: string
  populationCategory: string
  sexCategory: string
  sourceUnit: '千人'
  derivedDisplayUnit: '人'
  precision: number
  fromYear: number
  toYear: number
  generatedAt: string
  statsDataIds: string[]
  seriesPolicy: SeriesPolicy[]
  notes: string[]
}

export interface PopulationRecord {
  year: number
  prefectureCode: PrefectureCode
  estatAreaCode: string
  prefecture: string
  populationThousand: number
  population: number
  sourceStatsDataId: string
  seriesType: SeriesType
}

export interface PopulationData {
  metadata: PopulationMetadata
  records: PopulationRecord[]
}

export interface PopulationMetricRecord extends PopulationRecord {
  index: number
  annualChange: number | null
  annualChangeRate: number | null
}

export interface PopulationSummaryData {
  prefectureCode: PrefectureCode
  prefecture: string
  latestYear: number
  latestPopulation: number
  totalChange: number
  totalChangeRate: number
  latestAnnualChange: number | null
}
