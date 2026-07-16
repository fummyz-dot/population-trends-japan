import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { validatePopulationData } from './lib/population-schema.mjs'

const inputPath = resolve(process.argv[2] ?? 'public/data/population.json')

try {
  const data = JSON.parse(await readFile(inputPath, 'utf8'))
  const { errors, warnings } = validatePopulationData(data)
  warnings.forEach((warning) => console.warn(`警告: ${warning}`))
  if (errors.length > 0) {
    errors.forEach((error) => console.error(`検証エラー: ${error}`))
    process.exitCode = 1
  } else {
    console.log(`検証成功: ${inputPath}`)
    console.log(`年範囲: ${data.metadata.fromYear}～${data.metadata.toYear}`)
    console.log(`都道府県数: ${new Set(data.records.map((record) => record.prefectureCode)).size}`)
    console.log(`レコード数: ${data.records.length}`)
  }
} catch (error) {
  console.error(`検証に失敗しました: ${error.message}`)
  process.exitCode = 1
}
