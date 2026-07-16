import { resolve } from 'node:path'
import { createEstatClient } from './lib/estat-client.mjs'
import { updatePopulationFile } from './lib/population-comparison.mjs'
import {
  SERIES_SOURCES,
  TARGET_PREFECTURES,
  buildPopulationData,
  recordsFromEstatResponse,
} from './lib/population-schema.mjs'

const outputPath = resolve('public/data/population.json')
const temporaryPath = resolve(`public/data/.population.${process.pid}.tmp`)
const appId = process.env.ESTAT_APP_ID?.trim()

function queryForSource(source) {
  return {
    statsDataId: source.statsDataId,
    cdTab: '001',
    cdCat01: '000',
    cdCat02: '001',
    cdArea: TARGET_PREFECTURES.map((item) => item.estatAreaCode).join(','),
    cdTime: Object.values(source.timeCodes).join(','),
    metaGetFlg: 'N',
    cntGetFlg: 'N',
    explanationGetFlg: 'N',
    limit: '100',
    lang: 'J',
  }
}

async function main() {
  if (!appId) throw new Error('ESTAT_APP_IDが設定されていません')
  const client = createEstatClient({ appId })
  const records = []

  for (const source of SERIES_SOURCES) {
    const root = await client.getStatsData(queryForSource(source))
    const sourceRecords = recordsFromEstatResponse(root, source)
    records.push(...sourceRecords)
    console.log(
      `${source.statsDataId}: ${source.fromYear}～${source.toYear}年、${sourceRecords.length}件を取得`,
    )
  }

  const data = buildPopulationData(records, '1970-01-01T00:00:00.000Z')
  const result = await updatePopulationFile({ nextData: data, outputPath, temporaryPath })
  result.warnings.forEach((warning) => console.warn(`警告: ${warning}`))
  if (result.changed) {
    console.log(`生成完了: ${outputPath}`)
  } else {
    console.log('Population data has no substantive changes.')
  }
  console.log(`APIリクエスト数: ${client.requestCount}`)
  console.log(`年範囲: ${data.metadata.fromYear}～${data.metadata.toYear}`)
  console.log(`レコード数: ${data.records.length}`)
}

try {
  await main()
} catch (error) {
  console.error(`人口データの取得に失敗しました: ${error.message}`)
  process.exitCode = 1
}
