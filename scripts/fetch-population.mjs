import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createEstatClient } from './lib/estat-client.mjs'
import {
  SERIES_SOURCES,
  TARGET_PREFECTURES,
  buildPopulationData,
  recordsFromEstatResponse,
  validatePopulationData,
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

  const data = buildPopulationData(records)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')

  const temporaryData = JSON.parse(await readFile(temporaryPath, 'utf8'))
  const { errors, warnings } = validatePopulationData(temporaryData)
  warnings.forEach((warning) => console.warn(`警告: ${warning}`))
  if (errors.length > 0) {
    errors.forEach((error) => console.error(`検証エラー: ${error}`))
    throw new Error(`生成データの検証に失敗しました (${errors.length}件)`)
  }

  await rename(temporaryPath, outputPath)
  console.log(`生成完了: ${outputPath}`)
  console.log(`APIリクエスト数: ${client.requestCount}`)
  console.log(`年範囲: ${data.metadata.fromYear}～${data.metadata.toYear}`)
  console.log(`レコード数: ${data.records.length}`)
}

try {
  await main()
} catch (error) {
  console.error(`人口データの取得に失敗しました: ${error.message}`)
  process.exitCode = 1
} finally {
  await unlink(temporaryPath).catch((error) => {
    if (error.code !== 'ENOENT') console.warn(`一時ファイルを削除できませんでした: ${error.message}`)
  })
}
