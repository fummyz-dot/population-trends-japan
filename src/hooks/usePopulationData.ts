import { useEffect, useState } from 'react'
import { loadPopulation, PopulationDataValidationError } from '../services/loadPopulation'
import type { PopulationData } from '../types/population'

interface PopulationDataState {
  data: PopulationData | null
  loading: boolean
  error: string | null
}

export function usePopulationData(): PopulationDataState {
  const [state, setState] = useState<PopulationDataState>({
    data: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    const controller = new AbortController()

    loadPopulation(controller.signal)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        const message =
          error instanceof PopulationDataValidationError
            ? '人口データの内容を確認できませんでした。データ形式が不正です。'
            : '人口データを取得できませんでした。時間をおいて再度お試しください。'
        setState({ data: null, loading: false, error: message })
      })

    return () => controller.abort()
  }, [])

  return state
}
