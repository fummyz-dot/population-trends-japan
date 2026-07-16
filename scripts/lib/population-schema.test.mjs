// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  SERIES_SOURCES,
  TARGET_PREFECTURES,
  buildPopulationData,
  recordsFromEstatResponse,
  seriesTypeForYear,
  validatePopulationData,
} from './population-schema.mjs'

function validRecords() {
  return SERIES_SOURCES.flatMap((source) =>
    Array.from({ length: source.toYear - source.fromYear + 1 }, (_, yearIndex) => {
      const year = source.fromYear + yearIndex
      return TARGET_PREFECTURES.map((prefecture, prefectureIndex) => {
        const populationThousand = 1_000 + prefectureIndex * 100 + (year - 2015) * 2
        return {
          year,
          ...prefecture,
          populationThousand,
          population: populationThousand * 1_000,
          sourceStatsDataId: source.statsDataId,
          seriesType: seriesTypeForYear(year),
        }
      })
    }).flat(),
  )
}

function validData() {
  return buildPopulationData(validRecords(), '2026-07-16T00:00:00.000Z')
}

function errorText(data) {
  return validatePopulationData(data).errors.join('\n')
}

describe('validatePopulationData', () => {
  it('正常データを受け入れる', () => {
    expect(validatePopulationData(validData())).toEqual({ errors: [], warnings: [] })
  })

  it('年欠損を検出する', () => {
    const data = validData()
    data.records = data.records.filter(
      (record) => !(record.year === 2018 && record.prefectureCode === '01'),
    )
    expect(errorText(data)).toContain('北海道の年が2015～2024で連続していません')
  })

  it('都道府県欠損を検出する', () => {
    const data = validData()
    data.records = data.records.filter((record) => record.prefectureCode !== '47')
    expect(errorText(data)).toContain('対象都道府県数が5件ではありません')
  })

  it('重複レコードを検出する', () => {
    const data = validData()
    data.records.push({ ...data.records[0] })
    expect(errorText(data)).toContain('年×都道府県が重複しています')
  })

  it('不正な都道府県コードを検出する', () => {
    const data = validData()
    data.records[0].prefectureCode = '99'
    expect(errorText(data)).toContain('不正な都道府県コードです: 99')
  })

  it('取得元統計表IDの誤りを検出する', () => {
    const data = validData()
    data.records.find((record) => record.year === 2021).sourceStatsDataId = '0004021102'
    expect(errorText(data)).toContain('取得元統計表IDが年に対応していません')
  })

  it('年とseriesTypeの不一致を検出する', () => {
    const data = validData()
    data.records.find((record) => record.year === 2020).seriesType = 'population-estimate'
    expect(errorText(data)).toContain('seriesTypeが年に対応していません')
  })

  it('populationの換算誤りを検出する', () => {
    const data = validData()
    data.records[0].population += 1
    expect(errorText(data)).toContain('populationの換算が不正です')
  })

  it('日本人人口を示すmetadataを拒否する', () => {
    const data = validData()
    data.metadata.populationCategory = '日本人人口'
    expect(errorText(data)).toContain('metadata.populationCategoryが総人口ではありません')
  })

  it('API抽出時に日本人人口の値を拒否する', () => {
    const source = SERIES_SOURCES[0]
    const root = {
      STATISTICAL_DATA: {
        DATA_INF: {
          VALUE: {
            '@tab': '001',
            '@cat01': '000',
            '@cat02': '002',
            '@area': '01000',
            '@time': '2015000000',
            '@unit': '千人',
            $: '5382',
          },
        },
      },
    }
    expect(() => recordsFromEstatResponse(root, source)).toThrow('日本人人口を含む')
  })

  it('metadata欠損を検出する', () => {
    const data = validData()
    delete data.metadata.referenceDate
    expect(errorText(data)).toContain('metadata.referenceDateが存在しません')
  })

  it('レコード順序の誤りを検出する', () => {
    const data = validData()
    ;[data.records[0], data.records[1]] = [data.records[1], data.records[0]]
    expect(errorText(data)).toContain('recordsが年、都道府県コード順に整列されていません')
  })

  it('異常な前年比変動を警告として返す', () => {
    const data = validData()
    data.records.find(
      (record) => record.year === 2016 && record.prefectureCode === '01',
    ).populationThousand = 2_000
    data.records.find(
      (record) => record.year === 2016 && record.prefectureCode === '01',
    ).population = 2_000_000
    const result = validatePopulationData(data)
    expect(result.errors).toEqual([])
    expect(result.warnings.some((warning) => warning.includes('北海道 2015→2016'))).toBe(true)
  })
})
