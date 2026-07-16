import { describe, expect, it } from 'vitest'
import { populationFixture } from '../test/populationFixture'
import type { PrefectureCode } from '../types/population'
import { calculatePopulationMetrics } from './populationMetrics'
import {
  CSV_HEADERS,
  createPopulationCsvFilename,
  escapeCsvValue,
  generatePopulationCsv,
} from './csv'

const records = calculatePopulationMetrics(populationFixture.records)

function csvLines(selected: PrefectureCode[] = ['01']) {
  return generatePopulationCsv(records, selected, 2016).slice(1).split('\r\n').filter(Boolean)
}

describe('generatePopulationCsv', () => {
  it('UTF-8 BOMを先頭に付ける', () => {
    expect(generatePopulationCsv(records, ['01'], 2016).charCodeAt(0)).toBe(0xfeff)
  })

  it('CRLFだけを改行コードとして使用する', () => {
    const csv = generatePopulationCsv(records, ['01'], 2016)
    expect(csv).toContain('\r\n')
    expect(csv.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/)
  })

  it('仕様どおりのヘッダー列を出力する', () => {
    expect(csvLines()[0]).toBe(CSV_HEADERS.join(','))
  })

  it('2015年の前年差と前年比を空欄にする', () => {
    const columns = csvLines()[1].split(',')
    expect(columns[6]).toBe('')
    expect(columns[7]).toBe('')
  })

  it('2016年以降の前年差、増減率、2015年指数を正しく出力する', () => {
    const lines = csvLines()
    const row2015 = lines[1].split(',')
    const row2016 = lines[2].split(',')
    expect(row2016[6]).toBe('100000')
    expect(row2016[7]).toBe('2')
    expect(row2015[8]).toBe('100')
  })

  it('選択した都道府県だけを出力する', () => {
    const rows = csvLines(['13']).slice(1).map((line) => line.split(','))
    expect(rows).toHaveLength(2)
    expect(rows.every((columns) => columns[1] === '13')).toBe(true)
  })

  it('年の古い順、同一年内は所定の都道府県順に並べる', () => {
    const keys = csvLines(['47', '01', '27'])
      .slice(1)
      .map((line) => {
        const columns = line.split(',')
        return `${columns[0]}-${columns[1]}`
      })
    expect(keys).toEqual([
      '2015-01',
      '2015-27',
      '2015-47',
      '2016-01',
      '2016-27',
      '2016-47',
    ])
  })

  it('数値をlocale非依存かつ3桁区切りなしで出力する', () => {
    const columns = csvLines()[1].split(',')
    expect(columns[4]).toBe('5000')
    expect(columns[5]).toBe('5000000')
  })
})

describe('escapeCsvValue', () => {
  it('カンマを含む文字列を引用符で囲む', () => {
    expect(escapeCsvValue('北海道,北部')).toBe('"北海道,北部"')
  })

  it('ダブルクォートを二重化する', () => {
    expect(escapeCsvValue('北海道"北部"')).toBe('"北海道""北部"""')
  })

  it('改行を含む文字列を引用符で囲む', () => {
    expect(escapeCsvValue('北海道\n北部')).toBe('"北海道\n北部"')
  })

  it('nullとundefinedを空欄にする', () => {
    expect(escapeCsvValue(null)).toBe('')
    expect(escapeCsvValue(undefined)).toBe('')
  })
})

describe('createPopulationCsvFilename', () => {
  it('複数選択を所定順でファイル名に含める', () => {
    expect(createPopulationCsvFilename(2024, ['40', '01', '13'])).toBe(
      'population-trends-2015-2024-01-13-40.csv',
    )
  })

  it('5件すべての選択をallにする', () => {
    expect(createPopulationCsvFilename(2024, ['01', '13', '27', '40', '47'])).toBe(
      'population-trends-2015-2024-all.csv',
    )
  })
})
