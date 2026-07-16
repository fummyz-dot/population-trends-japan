import { describe, expect, it, vi } from 'vitest'
import { populationFixture } from '../test/populationFixture'
import {
  loadPopulation,
  PopulationDataValidationError,
  PopulationHttpError,
} from './loadPopulation'

describe('loadPopulation', () => {
  it('正常なJSONを読み込む', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(populationFixture), { status: 200 }),
    )

    await expect(loadPopulation(undefined, fetchImpl)).resolves.toEqual(populationFixture)
    expect(fetchImpl).toHaveBeenCalledWith('/data/population.json', { signal: undefined })
  })

  it('HTTPエラーを区別する', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
    await expect(loadPopulation(undefined, fetchImpl)).rejects.toBeInstanceOf(PopulationHttpError)
  })

  it('解析できないJSONを不正データとして扱う', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{broken', { status: 200 }))
    await expect(loadPopulation(undefined, fetchImpl)).rejects.toBeInstanceOf(
      PopulationDataValidationError,
    )
  })
})
