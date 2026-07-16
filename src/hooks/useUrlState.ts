import { useEffect, useState } from 'react'
import type { MetricType, PrefectureCode } from '../types/population'
import { METRICS, PREFECTURES } from '../utils/populationMetrics'

const allPrefectures = PREFECTURES.map((prefecture) => prefecture.code)
const validPrefectures = new Set<PrefectureCode>(allPrefectures)
const validMetrics = new Set<MetricType>(METRICS.map((metric) => metric.type))

export interface PopulationUrlState {
  selectedPrefectures: PrefectureCode[]
  metric: MetricType
}

export function parsePopulationUrl(search: string): PopulationUrlState {
  const params = new URLSearchParams(search)
  const prefsValue = params.get('prefs')
  let selectedPrefectures = allPrefectures
  if (prefsValue) {
    const requested = prefsValue.split(',')
    const isValid = requested.length > 0 && requested.every((code) => validPrefectures.has(code as PrefectureCode))
    if (isValid) {
      const unique = new Set(requested as PrefectureCode[])
      selectedPrefectures = allPrefectures.filter((code) => unique.has(code))
    }
  }

  const metricValue = params.get('metric') as MetricType | null
  return {
    selectedPrefectures,
    metric: metricValue && validMetrics.has(metricValue) ? metricValue : 'population',
  }
}

export function useUrlState() {
  const [state, setState] = useState<PopulationUrlState>(() =>
    parsePopulationUrl(window.location.search),
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const prefs = state.selectedPrefectures.join(',')
    params.set('prefs', prefs)
    params.set('metric', state.metric)
    const query = params.toString().replace(`prefs=${encodeURIComponent(prefs)}`, `prefs=${prefs}`)
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
    )
  }, [state])

  function togglePrefecture(code: PrefectureCode) {
    setState((current) => {
      const selected = current.selectedPrefectures.includes(code)
      if (selected && current.selectedPrefectures.length === 1) return current
      return {
        ...current,
        selectedPrefectures: selected
          ? current.selectedPrefectures.filter((item) => item !== code)
          : allPrefectures.filter(
              (item) => item === code || current.selectedPrefectures.includes(item),
            ),
      }
    })
  }

  function setMetric(metric: MetricType) {
    setState((current) => ({ ...current, metric }))
  }

  return { ...state, togglePrefecture, setMetric }
}
