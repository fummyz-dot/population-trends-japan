export interface PopulationMetadata {
  title: string
  isSample: boolean
  notice: string
  unit: string
  startYear: number
  endYear: number
}

export interface PrefecturePopulation {
  code: string
  name: string
  values: number[]
}

export interface PopulationData {
  metadata: PopulationMetadata
  prefectures: PrefecturePopulation[]
}
