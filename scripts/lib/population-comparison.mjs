import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { validatePopulationData } from './population-schema.mjs'

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value
      .map(canonicalize)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    )
  }

  return value
}

export function normalizePopulationForComparison(data) {
  const comparableData = structuredClone(data)

  if (
    comparableData !== null &&
    typeof comparableData === 'object' &&
    comparableData.metadata !== null &&
    typeof comparableData.metadata === 'object'
  ) {
    delete comparableData.metadata.generatedAt
  }

  return canonicalize(comparableData)
}

export function hasSubstantivePopulationChanges(currentData, nextData) {
  return JSON.stringify(normalizePopulationForComparison(currentData)) !==
    JSON.stringify(normalizePopulationForComparison(nextData))
}

function validateOrThrow(data) {
  const validation = validatePopulationData(data)
  if (validation.errors.length > 0) {
    const detail = validation.errors.map((error) => `検証エラー: ${error}`).join('\n')
    throw new Error(`生成データの検証に失敗しました (${validation.errors.length}件)\n${detail}`)
  }
  return validation.warnings
}

async function readExistingData(outputPath) {
  try {
    return JSON.parse(await readFile(outputPath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw error
  }
}

export async function updatePopulationFile({
  nextData,
  outputPath,
  temporaryPath,
  now = () => new Date(),
}) {
  const warnings = validateOrThrow(nextData)
  const currentData = await readExistingData(outputPath)

  if (currentData && !hasSubstantivePopulationChanges(currentData, nextData)) {
    return { changed: false, data: currentData, warnings }
  }

  const finalData = structuredClone(nextData)
  finalData.metadata.generatedAt = now().toISOString()
  validateOrThrow(finalData)

  try {
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(temporaryPath, `${JSON.stringify(finalData, null, 2)}\n`, 'utf8')

    const temporaryData = JSON.parse(await readFile(temporaryPath, 'utf8'))
    const temporaryWarnings = validateOrThrow(temporaryData)
    await rename(temporaryPath, outputPath)
    return { changed: true, data: temporaryData, warnings: temporaryWarnings }
  } finally {
    await unlink(temporaryPath).catch((error) => {
      if (error.code !== 'ENOENT') throw error
    })
  }
}
