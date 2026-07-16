import { describe, expect, it } from 'vitest'
import { parsePopulationUrl } from './useUrlState'

describe('parsePopulationUrl', () => {
  it('有効な都道府県と指標を復元し、表示順を固定する', () => {
    expect(parsePopulationUrl('?prefs=47,01,13&metric=annualChangeRate')).toEqual({
      selectedPrefectures: ['01', '13', '47'],
      metric: 'annualChangeRate',
    })
  })

  it('不正な都道府県コードと指標を既定値へ戻す', () => {
    expect(parsePopulationUrl('?prefs=01,99&metric=other')).toEqual({
      selectedPrefectures: ['01', '13', '27', '40', '47'],
      metric: 'population',
    })
  })
})
