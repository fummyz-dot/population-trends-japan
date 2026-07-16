// @vitest-environment node

import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  hasSubstantivePopulationChanges,
  updatePopulationFile,
} from './population-comparison.mjs'
import {
  SERIES_SOURCES,
  TARGET_PREFECTURES,
  buildPopulationData,
  seriesTypeForYear,
} from './population-schema.mjs'

const directories = []

function validData(generatedAt = '2026-07-16T00:00:00.000Z') {
  const records = SERIES_SOURCES.flatMap((source) =>
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
  return buildPopulationData(records, generatedAt)
}

function clone(data) {
  return structuredClone(data)
}

function reverseObjectKeyOrder(value) {
  if (Array.isArray(value)) return value.map(reverseObjectKeyOrder)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, item]) => [key, reverseObjectKeyOrder(item)]),
  )
}

async function filePaths() {
  const directory = await mkdtemp(join(tmpdir(), 'population-comparison-'))
  directories.push(directory)
  return {
    outputPath: join(directory, 'population.json'),
    temporaryPath: join(directory, '.population.tmp'),
  }
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })))
})

describe('hasSubstantivePopulationChanges', () => {
  it('同一データを変更なしと判断する', () => {
    const data = validData()
    expect(hasSubstantivePopulationChanges(data, clone(data))).toBe(false)
  })

  it('generatedAtだけの差を変更なしと判断する', () => {
    const current = validData('2026-07-16T00:00:00.000Z')
    const next = validData('2026-07-17T00:00:00.000Z')
    expect(hasSubstantivePopulationChanges(current, next)).toBe(false)
  })

  it('1レコードの人口の差を変更と判断する', () => {
    const current = validData()
    const next = clone(current)
    next.records[0].population += 1_000
    expect(hasSubstantivePopulationChanges(current, next)).toBe(true)
  })

  it.each([
    ['metadata.toYear', (data) => {
      data.metadata.toYear += 1
    }],
    ['metadata.statsDataIds', (data) => {
      data.metadata.statsDataIds.push('new-id')
    }],
    ['metadata.notes', (data) => {
      data.metadata.notes.push('新しい注記')
    }],
  ])('%sの差を変更と判断する', (_name, mutate) => {
    const current = validData()
    const next = clone(current)
    mutate(next)
    expect(hasSubstantivePopulationChanges(current, next)).toBe(true)
  })

  it('配列順とオブジェクトのキー順だけの差を変更なしと判断する', () => {
    const current = validData()
    const next = reverseObjectKeyOrder(current)
    next.metadata.statsDataIds.reverse()
    next.metadata.seriesPolicy.reverse()
    next.metadata.notes.reverse()
    next.records.reverse()
    expect(hasSubstantivePopulationChanges(current, next)).toBe(false)
  })
})

describe('updatePopulationFile', () => {
  it('変更がない場合はファイルを置換せず既存generatedAtを維持する', async () => {
    const paths = await filePaths()
    const current = validData('2026-07-16T00:00:00.000Z')
    const next = validData('2026-07-17T00:00:00.000Z')
    await writeFile(paths.outputPath, `${JSON.stringify(current, null, 2)}\n`)
    const before = await stat(paths.outputPath)

    const result = await updatePopulationFile({
      ...paths,
      nextData: next,
      now: () => new Date('2026-07-18T00:00:00.000Z'),
    })

    const after = await stat(paths.outputPath)
    const saved = JSON.parse(await readFile(paths.outputPath, 'utf8'))
    expect(result.changed).toBe(false)
    expect(after.ino).toBe(before.ino)
    expect(saved.metadata.generatedAt).toBe('2026-07-16T00:00:00.000Z')
  })

  it('検証失敗時は既存ファイルを変更しない', async () => {
    const paths = await filePaths()
    const current = validData()
    const invalid = clone(current)
    invalid.records[0].population += 1
    await writeFile(paths.outputPath, `${JSON.stringify(current, null, 2)}\n`)

    await expect(updatePopulationFile({ ...paths, nextData: invalid })).rejects.toThrow(
      '生成データの検証に失敗しました',
    )
    expect(JSON.parse(await readFile(paths.outputPath, 'utf8'))).toEqual(current)
  })

  it('実質的な変更がある場合だけ現在日時を設定してファイルを置換する', async () => {
    const paths = await filePaths()
    const current = validData('2026-07-16T00:00:00.000Z')
    const next = clone(current)
    next.records[0].populationThousand += 1
    next.records[0].population += 1_000
    await writeFile(paths.outputPath, `${JSON.stringify(current, null, 2)}\n`)
    const before = await stat(paths.outputPath)

    const result = await updatePopulationFile({
      ...paths,
      nextData: next,
      now: () => new Date('2026-07-18T12:34:56.000Z'),
    })

    const after = await stat(paths.outputPath)
    const saved = JSON.parse(await readFile(paths.outputPath, 'utf8'))
    expect(result.changed).toBe(true)
    expect(after.ino).not.toBe(before.ino)
    expect(saved.records[0].population).toBe(next.records[0].population)
    expect(saved.metadata.generatedAt).toBe('2026-07-18T12:34:56.000Z')
  })
})
