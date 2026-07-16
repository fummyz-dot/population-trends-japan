import type {
  PopulationData,
  PopulationMetadata,
  PopulationRecord,
  PrefectureCode,
} from '../types/population'

const prefectures = {
  '01': { estatAreaCode: '01000', name: '北海道' },
  '13': { estatAreaCode: '13000', name: '東京都' },
  '27': { estatAreaCode: '27000', name: '大阪府' },
  '40': { estatAreaCode: '40000', name: '福岡県' },
  '47': { estatAreaCode: '47000', name: '沖縄県' },
} as const
const prefectureCodes = new Set<PrefectureCode>(Object.keys(prefectures) as PrefectureCode[])
const seriesTypes = new Set(['census-anchor', 'interpolated-adjusted', 'population-estimate'])

export class PopulationHttpError extends Error {
  constructor(status: number) {
    super(`人口データの取得に失敗しました（HTTP ${status}）`)
    this.name = 'PopulationHttpError'
  }
}

export class PopulationDataValidationError extends Error {
  constructor(message: string) {
    super(`人口データの形式が不正です: ${message}`)
    this.name = 'PopulationDataValidationError'
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(object: Record<string, unknown>, key: string) {
  if (typeof object[key] !== 'string' || object[key] === '') {
    throw new PopulationDataValidationError(`metadata.${key}`)
  }
}

function validateMetadata(value: unknown): asserts value is PopulationMetadata {
  if (!isObject(value)) throw new PopulationDataValidationError('metadataがありません')
  for (const key of [
    'title',
    'source',
    'api',
    'referenceDate',
    'populationCategory',
    'sexCategory',
    'sourceUnit',
    'derivedDisplayUnit',
    'generatedAt',
  ]) {
    requireString(value, key)
  }
  if (!Number.isInteger(value.fromYear) || !Number.isInteger(value.toYear)) {
    throw new PopulationDataValidationError('metadataの年範囲')
  }
  if (typeof value.precision !== 'number' || value.precision <= 0) {
    throw new PopulationDataValidationError('metadata.precision')
  }
  if (!Array.isArray(value.statsDataIds) || !value.statsDataIds.every((item) => typeof item === 'string')) {
    throw new PopulationDataValidationError('metadata.statsDataIds')
  }
  if (!Array.isArray(value.seriesPolicy) || !Array.isArray(value.notes)) {
    throw new PopulationDataValidationError('metadataの系列情報')
  }
  if (
    value.notes.some((note) => typeof note !== 'string') ||
    value.seriesPolicy.some(
      (policy) =>
        !isObject(policy) ||
        !Number.isInteger(policy.fromYear) ||
        !Number.isInteger(policy.toYear) ||
        typeof policy.statsDataId !== 'string',
    )
  ) {
    throw new PopulationDataValidationError('metadataの系列情報の内容')
  }
  if (typeof value.generatedAt !== 'string' || Number.isNaN(Date.parse(value.generatedAt))) {
    throw new PopulationDataValidationError('metadata.generatedAt')
  }
  if (
    value.populationCategory !== '総人口' ||
    value.sexCategory !== '男女計' ||
    value.sourceUnit !== '千人'
  ) {
    throw new PopulationDataValidationError('対象分類または単位')
  }
}

function validateRecord(value: unknown, index: number): asserts value is PopulationRecord {
  if (!isObject(value)) throw new PopulationDataValidationError(`records[${index}]`)
  if (!Number.isInteger(value.year)) throw new PopulationDataValidationError(`records[${index}].year`)
  if (typeof value.prefectureCode !== 'string' || !prefectureCodes.has(value.prefectureCode as PrefectureCode)) {
    throw new PopulationDataValidationError(`records[${index}].prefectureCode`)
  }
  for (const key of ['estatAreaCode', 'prefecture', 'sourceStatsDataId']) {
    if (typeof value[key] !== 'string' || value[key] === '') {
      throw new PopulationDataValidationError(`records[${index}].${key}`)
    }
  }
  const prefecture = prefectures[value.prefectureCode as PrefectureCode]
  if (value.estatAreaCode !== prefecture.estatAreaCode || value.prefecture !== prefecture.name) {
    throw new PopulationDataValidationError(`records[${index}]の都道府県情報`)
  }
  if (
    typeof value.populationThousand !== 'number' ||
    value.populationThousand <= 0 ||
    typeof value.population !== 'number' ||
    value.population !== value.populationThousand * 1_000
  ) {
    throw new PopulationDataValidationError(`records[${index}]の人口値`)
  }
  if (typeof value.seriesType !== 'string' || !seriesTypes.has(value.seriesType)) {
    throw new PopulationDataValidationError(`records[${index}].seriesType`)
  }
}

export function validatePopulationData(value: unknown): asserts value is PopulationData {
  if (!isObject(value)) throw new PopulationDataValidationError('ルートオブジェクト')
  validateMetadata(value.metadata)
  if (!Array.isArray(value.records) || value.records.length === 0) {
    throw new PopulationDataValidationError('recordsが空です')
  }
  value.records.forEach(validateRecord)

  const expectedKeys = new Set<string>()
  for (let year = value.metadata.fromYear; year <= value.metadata.toYear; year += 1) {
    for (const code of prefectureCodes) expectedKeys.add(`${year}-${code}`)
  }
  for (const record of value.records) {
    const key = `${record.year}-${record.prefectureCode}`
    if (!expectedKeys.delete(key)) {
      throw new PopulationDataValidationError(`対象外または重複したレコード（${key}）`)
    }
  }
  if (expectedKeys.size > 0) {
    throw new PopulationDataValidationError(`不足レコード（${expectedKeys.values().next().value}）`)
  }
}

export async function loadPopulation(
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<PopulationData> {
  const response = await fetchImpl('/data/population.json', { signal })
  if (!response.ok) throw new PopulationHttpError(response.status)

  let value: unknown
  try {
    value = await response.json()
  } catch (error) {
    throw new PopulationDataValidationError(
      error instanceof Error ? `JSONを解析できません（${error.message}）` : 'JSONを解析できません',
    )
  }
  validatePopulationData(value)
  return value
}
