import type { PopulationData, PopulationRecord } from '../types/population'

const prefectures = [
  { prefectureCode: '01', estatAreaCode: '01000', prefecture: '北海道', base: 5_000_000 },
  { prefectureCode: '13', estatAreaCode: '13000', prefecture: '東京都', base: 10_000_000 },
  { prefectureCode: '27', estatAreaCode: '27000', prefecture: '大阪府', base: 8_000_000 },
  { prefectureCode: '40', estatAreaCode: '40000', prefecture: '福岡県', base: 4_000_000 },
  { prefectureCode: '47', estatAreaCode: '47000', prefecture: '沖縄県', base: 1_000_000 },
] as const

const records: PopulationRecord[] = prefectures.flatMap((prefecture) =>
  [2015, 2016].map((year) => {
    const population = prefecture.base + (year - 2015) * 100_000
    return {
      year,
      prefectureCode: prefecture.prefectureCode,
      estatAreaCode: prefecture.estatAreaCode,
      prefecture: prefecture.prefecture,
      populationThousand: population / 1_000,
      population,
      sourceStatsDataId: '0004021102',
      seriesType: year === 2015 ? 'census-anchor' : 'interpolated-adjusted',
    }
  }),
)

export const populationFixture: PopulationData = {
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
    fromYear: 2015,
    toYear: 2016,
    generatedAt: '2026-07-15T12:34:56.000Z',
    statsDataIds: ['0004021102', '0003448232'],
    seriesPolicy: [
      { fromYear: 2015, toYear: 2020, statsDataId: '0004021102' },
      { fromYear: 2021, toYear: 2024, statsDataId: '0003448232' },
    ],
    notes: [
      '2016年から2019年は令和2年国勢調査結果に基づく補間補正人口です。',
      '2015年と2020年は国勢調査を基にした接続年です。',
    ],
  },
  records,
}
