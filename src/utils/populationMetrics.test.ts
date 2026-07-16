import { describe, expect, it } from 'vitest'
import { populationFixture } from '../test/populationFixture'
import { calculatePopulationMetrics, createPopulationSummaries } from './populationMetrics'

describe('人口指標の計算', () => {
  const metrics = calculatePopulationMetrics(populationFixture.records)
  const hokkaido2015 = metrics.find(
    (record) => record.prefectureCode === '01' && record.year === 2015,
  )
  const hokkaido2016 = metrics.find(
    (record) => record.prefectureCode === '01' && record.year === 2016,
  )

  it('2015年の指数を100、前年差と前年比をnullにする', () => {
    expect(hokkaido2015).toMatchObject({
      index: 100,
      annualChange: null,
      annualChangeRate: null,
    })
  })

  it('前年増減数と前年増減率を計算する', () => {
    expect(hokkaido2016?.annualChange).toBe(100_000)
    expect(hokkaido2016?.annualChangeRate).toBeCloseTo(2)
    expect(hokkaido2016?.index).toBeCloseTo(102)
  })

  it('期間全体の増減数と増減率を計算する', () => {
    const [summary] = createPopulationSummaries(metrics, ['01'])
    expect(summary).toMatchObject({
      latestYear: 2016,
      latestPopulation: 5_100_000,
      totalChange: 100_000,
      totalChangeRate: 2,
      latestAnnualChange: 100_000,
    })
  })
})
