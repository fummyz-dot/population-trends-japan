export const TARGET_PREFECTURES = [
  { prefectureCode: '01', estatAreaCode: '01000', prefecture: '北海道' },
  { prefectureCode: '13', estatAreaCode: '13000', prefecture: '東京都' },
  { prefectureCode: '27', estatAreaCode: '27000', prefecture: '大阪府' },
  { prefectureCode: '40', estatAreaCode: '40000', prefecture: '福岡県' },
  { prefectureCode: '47', estatAreaCode: '47000', prefecture: '沖縄県' },
]

export const SERIES_SOURCES = [
  {
    statsDataId: '0004021102',
    fromYear: 2015,
    toYear: 2020,
    timeCodes: Object.fromEntries(
      Array.from({ length: 6 }, (_, index) => {
        const year = 2015 + index
        return [year, `${year}000000`]
      }),
    ),
  },
  {
    statsDataId: '0003448232',
    fromYear: 2021,
    toYear: 2024,
    timeCodes: Object.fromEntries(
      Array.from({ length: 4 }, (_, index) => {
        const year = 2021 + index
        return [year, `${year}000000`]
      }),
    ),
  },
]

export function seriesTypeForYear(year) {
  if (year === 2015 || year === 2020) return 'census-anchor'
  if (year >= 2016 && year <= 2019) return 'interpolated-adjusted'
  if (year >= 2021) return 'population-estimate'
  return undefined
}

function asArray(value) {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function sourceForYear(year) {
  return SERIES_SOURCES.find((source) => year >= source.fromYear && year <= source.toYear)
}

function parsePopulationValue(value, source) {
  if (String(value?.['@tab'] ?? '') !== '001') throw new Error('表章項目が人口ではありません')
  if (String(value?.['@cat01'] ?? '') !== '000') throw new Error('男女計以外の値が混入しています')
  if (String(value?.['@cat02'] ?? '') !== '001') {
    throw new Error('総人口以外（日本人人口を含む）の値が混入しています')
  }

  const unit = String(value?.['@unit'] ?? '')
  if (unit !== '千人') throw new Error(`想定外の単位です: ${unit || '不明'}`)

  const areaCode = String(value?.['@area'] ?? '')
  const prefecture = TARGET_PREFECTURES.find((item) => item.estatAreaCode === areaCode)
  if (!prefecture) throw new Error(`対象外または不明な地域コードです: ${areaCode}`)

  const timeCode = String(value?.['@time'] ?? '')
  const timeEntry = Object.entries(source.timeCodes).find(([, code]) => code === timeCode)
  if (!timeEntry) throw new Error(`対象外または不明な時間コードです: ${timeCode}`)
  const year = Number(timeEntry[0])

  const rawValue = String(value?.$ ?? '').replace(/,/g, '')
  if (!/^\d+(?:\.\d+)?$/.test(rawValue)) throw new Error(`人口値が数値ではありません: ${rawValue}`)
  const populationThousand = Number(rawValue)
  if (!(populationThousand > 0)) throw new Error(`人口値が正ではありません: ${rawValue}`)

  return {
    year,
    prefectureCode: prefecture.prefectureCode,
    estatAreaCode: prefecture.estatAreaCode,
    prefecture: prefecture.prefecture,
    populationThousand,
    population: populationThousand * 1_000,
    sourceStatsDataId: source.statsDataId,
    seriesType: seriesTypeForYear(year),
  }
}

export function recordsFromEstatResponse(root, source) {
  if (!SERIES_SOURCES.some((item) => item.statsDataId === source.statsDataId)) {
    throw new Error(`未定義の統計表IDです: ${source.statsDataId}`)
  }
  return asArray(root?.STATISTICAL_DATA?.DATA_INF?.VALUE).map((value) =>
    parsePopulationValue(value, source),
  )
}

export function sortPopulationRecords(records) {
  return [...records].sort(
    (a, b) => a.year - b.year || a.prefectureCode.localeCompare(b.prefectureCode),
  )
}

export function buildPopulationData(records, generatedAt = new Date().toISOString()) {
  const sortedRecords = sortPopulationRecords(records)
  const fromYear = Math.min(...sortedRecords.map((record) => record.year))
  const toYear = Math.max(...sortedRecords.map((record) => record.year))

  return {
    metadata: {
      title: '都道府県別人口推移',
      source: '総務省統計局 人口推計',
      api: '政府統計の総合窓口（e-Stat）API',
      referenceDate: '各年10月1日現在',
      populationCategory: '総人口',
      sexCategory: '男女計',
      sourceUnit: '千人',
      derivedDisplayUnit: '人',
      precision: 1_000,
      fromYear,
      toYear,
      generatedAt,
      statsDataIds: SERIES_SOURCES.map((source) => source.statsDataId),
      seriesPolicy: SERIES_SOURCES.map(({ fromYear: start, toYear: end, statsDataId }) => ({
        fromYear: start,
        toYear: end,
        statsDataId,
      })),
      notes: [
        '2016年から2019年は令和2年国勢調査結果に基づく補間補正人口です。',
        '2015年と2020年は国勢調査を基にした接続年です。',
        'populationは千人単位の原値を1000倍した派生値です。',
      ],
    },
    records: sortedRecords,
  }
}

function requiredMetadataErrors(metadata) {
  const required = [
    'title',
    'source',
    'api',
    'referenceDate',
    'populationCategory',
    'sexCategory',
    'sourceUnit',
    'derivedDisplayUnit',
    'precision',
    'fromYear',
    'toYear',
    'generatedAt',
    'statsDataIds',
    'seriesPolicy',
    'notes',
  ]
  if (!metadata || typeof metadata !== 'object') return ['metadataが存在しません']
  const errors = required
    .filter((key) => metadata[key] == null || metadata[key] === '')
    .map((key) => `metadata.${key}が存在しません`)
  if (metadata.populationCategory !== '総人口') errors.push('metadata.populationCategoryが総人口ではありません')
  if (metadata.sexCategory !== '男女計') errors.push('metadata.sexCategoryが男女計ではありません')
  if (metadata.sourceUnit !== '千人') errors.push('metadata.sourceUnitが千人ではありません')
  if (metadata.precision !== 1_000) errors.push('metadata.precisionが1000ではありません')
  if (Number.isNaN(Date.parse(metadata.generatedAt))) errors.push('metadata.generatedAtがISO 8601日時ではありません')
  return errors
}

export function validatePopulationData(data, { changeWarningThreshold = 0.1 } = {}) {
  const errors = requiredMetadataErrors(data?.metadata)
  const warnings = []
  const records = Array.isArray(data?.records) ? data.records : []
  if (!Array.isArray(data?.records)) errors.push('recordsが配列ではありません')

  const prefectureMap = new Map(TARGET_PREFECTURES.map((item) => [item.prefectureCode, item]))
  const actualPrefectures = new Set(records.map((record) => record.prefectureCode))
  if (actualPrefectures.size !== TARGET_PREFECTURES.length) {
    errors.push(`対象都道府県数が${TARGET_PREFECTURES.length}件ではありません`)
  }

  const seen = new Set()
  for (const record of records) {
    const key = `${record.year}:${record.prefectureCode}`
    if (seen.has(key)) errors.push(`年×都道府県が重複しています: ${key}`)
    seen.add(key)

    const expectedPrefecture = prefectureMap.get(record.prefectureCode)
    if (!expectedPrefecture) {
      errors.push(`不正な都道府県コードです: ${record.prefectureCode}`)
    } else if (
      record.estatAreaCode !== expectedPrefecture.estatAreaCode ||
      record.prefecture !== expectedPrefecture.prefecture
    ) {
      errors.push(`都道府県コード・地域コード・名称の対応が不正です: ${key}`)
    }

    const expectedSource = sourceForYear(record.year)
    if (!expectedSource || record.sourceStatsDataId !== expectedSource.statsDataId) {
      errors.push(`取得元統計表IDが年に対応していません: ${key}`)
    }
    if (record.seriesType !== seriesTypeForYear(record.year)) {
      errors.push(`seriesTypeが年に対応していません: ${key}`)
    }
    if (!(typeof record.populationThousand === 'number' && record.populationThousand > 0)) {
      errors.push(`populationThousandが正の数値ではありません: ${key}`)
    }
    if (record.population !== record.populationThousand * 1_000) {
      errors.push(`populationの換算が不正です: ${key}`)
    }
  }

  const fromYear = data?.metadata?.fromYear
  const toYear = data?.metadata?.toYear
  if (Number.isInteger(fromYear) && Number.isInteger(toYear) && fromYear <= toYear) {
    const expectedYears = Array.from({ length: toYear - fromYear + 1 }, (_, index) => fromYear + index)
    for (const prefecture of TARGET_PREFECTURES) {
      const years = records
        .filter((record) => record.prefectureCode === prefecture.prefectureCode)
        .map((record) => record.year)
        .sort((a, b) => a - b)
      if (years.join(',') !== expectedYears.join(',')) {
        errors.push(`${prefecture.prefecture}の年が${fromYear}～${toYear}で連続していません`)
      }
    }
  }

  const sortedRecords = sortPopulationRecords(records)
  if (records.some((record, index) => record !== sortedRecords[index])) {
    errors.push('recordsが年、都道府県コード順に整列されていません')
  }

  for (const prefecture of TARGET_PREFECTURES) {
    const prefectureRecords = sortedRecords.filter(
      (record) => record.prefectureCode === prefecture.prefectureCode,
    )
    for (let index = 1; index < prefectureRecords.length; index += 1) {
      const previous = prefectureRecords[index - 1]
      const current = prefectureRecords[index]
      const rate = (current.populationThousand - previous.populationThousand) / previous.populationThousand
      if (Math.abs(rate) > changeWarningThreshold) {
        warnings.push(
          `${prefecture.prefecture} ${previous.year}→${current.year}の人口変動が${(rate * 100).toFixed(2)}%です`,
        )
      }
    }
  }

  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}
