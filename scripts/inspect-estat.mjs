const API_BASE = 'https://api.e-stat.go.jp/rest/3.0/app/json'
const REQUEST_TIMEOUT_MS = 15_000
const SEARCH_RESULT_LIMIT = 100
const DISCOVERY_DISPLAY_LIMIT = 20
const TARGET_YEAR_MIN = 2015
const TARGET_YEAR_MAX = 2024
const COMPARISON_YEARS = [2015, 2020]

const knownTables = [
  {
    statsDataId: '0004021102',
    expected: '国勢調査結果による補間補正人口（2015年～2020年） 表005',
  },
  {
    statsDataId: '0003448232',
    expected: '令和2年国勢調査基準 表005',
  },
]

const targetPrefectures = [
  ['01', '北海道'],
  ['13', '東京都'],
  ['27', '大阪府'],
  ['40', '福岡県'],
  ['47', '沖縄県'],
]

class HttpError extends Error {
  constructor(status, statusText) {
    super(`HTTPエラー: ${status} ${statusText}`)
    this.name = 'HttpError'
  }
}

class EstatApiError extends Error {
  constructor(status, message, httpStatus) {
    super(`e-Stat APIエラー: STATUS=${status}, HTTP=${httpStatus}, ${message}`)
    this.name = 'EstatApiError'
  }
}

class TimeoutError extends Error {
  constructor(timeoutMs) {
    super(`タイムアウト: ${timeoutMs}ms以内に応答がありませんでした`)
    this.name = 'TimeoutError'
  }
}

const appId = process.env.ESTAT_APP_ID?.trim()
let requestCount = 0
const metadataCache = new Map()

function asArray(value) {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function text(value) {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' / ')
  if (typeof value === 'object') {
    if ('$' in value) return text(value.$)
    if ('@name' in value) return text(value['@name'])
  }
  return ''
}

function collectStrings(value, output = []) {
  if (value == null) return output
  if (typeof value === 'string' || typeof value === 'number') {
    output.push(String(value))
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output))
  } else if (typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, output))
  }
  return output
}

function normalizeDigits(value) {
  return String(value).replace(/[０-９]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0xfee0),
  )
}

function normalizeName(value) {
  return normalizeDigits(text(value))
    .replace(/[\s\u3000]/g, '')
    .replace(/，/g, ',')
    .replace(/１/g, '1')
}

function maskedUrl(url) {
  const safeUrl = new URL(url)
  if (safeUrl.searchParams.has('appId')) safeUrl.searchParams.set('appId', '***')
  return safeUrl.toString()
}

async function request(endpoint, params, rootName) {
  const url = new URL(`${API_BASE}/${endpoint}`)
  url.search = new URLSearchParams({ appId, ...params }).toString()
  requestCount += 1
  console.log(`\n[API ${requestCount}] ${maskedUrl(url)}`)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw new TimeoutError(REQUEST_TIMEOUT_MS)
    throw new Error(`通信エラー: ${error?.cause?.code ?? error?.name ?? 'unknown'}`, {
      cause: error,
    })
  } finally {
    clearTimeout(timer)
  }

  const bodyText = await response.text()
  let payload
  try {
    payload = JSON.parse(bodyText)
  } catch {
    if (!response.ok) throw new HttpError(response.status, response.statusText)
    throw new Error('JSON解析エラー: e-StatからJSON以外の応答が返されました')
  }

  const root = payload?.[rootName]
  const result = root?.RESULT
  const apiStatus = Number(result?.STATUS)

  if (Number.isFinite(apiStatus) && apiStatus >= 100) {
    throw new EstatApiError(apiStatus, text(result.ERROR_MSG) || '詳細不明', response.status)
  }
  if (!response.ok) throw new HttpError(response.status, response.statusText)
  if (!root || !Number.isFinite(apiStatus)) {
    throw new Error(`レスポンス構造エラー: ${rootName}.RESULT.STATUSが見つかりません`)
  }

  console.log(`  e-Stat STATUS=${apiStatus}: ${text(result.ERROR_MSG)}`)
  return root
}

function summarizeTable(table) {
  const specification = table?.STATISTICS_NAME_SPEC ?? table?.TITLE_SPEC ?? {}
  const title = text(table?.TITLE) || text(specification?.TABLE_NAME)
  const allText = collectStrings(table).join(' ')
  const classification1 =
    text(specification?.TABULATION_SUB_CATEGORY1) || text(table?.TABULATION_SUB_CATEGORY1)
  const classification2 =
    text(specification?.TABULATION_SUB_CATEGORY2) || text(table?.TABULATION_SUB_CATEGORY2)
  const tableNumber = String(
    table?.TITLE?.['@no'] ?? specification?.TABLE_NO ?? table?.['@no'] ?? '',
  )

  return {
    id: String(table?.['@id'] ?? ''),
    title,
    statsName: text(table?.STAT_NAME),
    cycle: text(table?.CYCLE),
    surveyDate: text(table?.SURVEY_DATE),
    openDate: text(table?.OPEN_DATE),
    classification1,
    classification2,
    tableNumber,
    allText,
  }
}

function detectBasis(table) {
  const value = normalizeName(`${table.classification2} ${table.allText}`)
  const censusMatch = value.match(/(?:令和|平成)\d+年国勢調査基準/)
  if (censusMatch) return censusMatch[0]
  if (value.includes('国勢調査結果による補間補正人口')) {
    return table.classification2 || '国勢調査結果による補間補正人口'
  }
  return '不明'
}

function discoveryStatus(table) {
  if (knownTables.some(({ statsDataId }) => statsDataId === table.id)) return '必須検証'
  const basis = normalizeName(detectBasis(table))
  const heiseiBasis = basis.match(/平成(\d+)年国勢調査基準/)
  if (heiseiBasis && Number(heiseiBasis[1]) < 27) {
    return '対象外（古い国勢調査基準）'
  }
  return '未検証（自動選択しない）'
}

function normalizeClassObject(classObject) {
  return {
    id: String(classObject?.['@id'] ?? ''),
    name: text(classObject?.['@name']),
    items: asArray(classObject?.CLASS).map((item) => ({
      code: String(item?.['@code'] ?? ''),
      name: text(item?.['@name']) || text(item),
      level: String(item?.['@level'] ?? ''),
      unit: text(item?.['@unit']),
    })),
  }
}

function parseMetadata(statsDataId, root) {
  const metadata = root?.METADATA_INF
  const table = summarizeTable(metadata?.TABLE_INF ?? {})
  const classes = asArray(metadata?.CLASS_INF?.CLASS_OBJ).map(normalizeClassObject)
  const notes = [...new Set(collectStrings(metadata?.EXPLANATION))]
    .filter((value) => /国勢調査|補間|基準|不連続|改定|遡及|接続/.test(value))
    .slice(0, 10)
  return { statsDataId, table, classes, notes }
}

async function getMetadata(statsDataId) {
  if (!metadataCache.has(statsDataId)) {
    metadataCache.set(
      statsDataId,
      request(
        'getMetaInfo',
        { statsDataId, explanationGetFlg: 'Y', lang: 'J' },
        'GET_META_INFO',
      ).then((root) => parseMetadata(statsDataId, root)),
    )
  }
  return metadataCache.get(statsDataId)
}

function findClassById(metadata, id) {
  return metadata.classes.find((classObject) => classObject.id.toLowerCase() === id.toLowerCase())
}

function findExactItem(classObject, expectedName) {
  if (!classObject) return undefined
  const expected = normalizeName(expectedName)
  return classObject.items.find((item) => normalizeName(item.name) === expected)
}

function yearFromTimeItem(item) {
  const nameMatch = normalizeName(item.name).match(/((?:19|20)\d{2})年?/)
  if (nameMatch) return Number(nameMatch[1])
  const codeMatch = normalizeDigits(item.code).match(/((?:19|20)\d{2})/)
  return codeMatch ? Number(codeMatch[1]) : undefined
}

function extractTargets(metadata) {
  const tabClass = findClassById(metadata, 'tab')
  const cat01Class = findClassById(metadata, 'cat01')
  const cat02Class = findClassById(metadata, 'cat02')
  const areaClass = findClassById(metadata, 'area')
  const timeClass = findClassById(metadata, 'time')
  const parsedYears = (timeClass?.items ?? [])
    .map((item) => ({ ...item, year: yearFromTimeItem(item) }))
    .filter(
      (item) =>
        Number.isInteger(item.year) && item.year >= TARGET_YEAR_MIN && item.year <= TARGET_YEAR_MAX,
    )
    .sort((a, b) => a.year - b.year)
  const years = [...new Map(parsedYears.map((item) => [item.year, item])).values()]

  const tabPopulation = findExactItem(tabClass, '人口') ?? tabClass?.items[0]
  const genderTotal = findExactItem(cat01Class, '男女計')
  const totalPopulation = findExactItem(cat02Class, '総人口')
  const japanesePopulation = findExactItem(cat02Class, '日本人人口')
  const prefectures = targetPrefectures.map(([requestedCode, name]) => ({
    requestedCode,
    name,
    item: findExactItem(areaClass, name),
  }))

  return {
    tabClass,
    cat01Class,
    cat02Class,
    areaClass,
    timeClass,
    tabPopulation,
    genderTotal,
    totalPopulation,
    japanesePopulation,
    prefectures,
    years,
    unit: tabPopulation?.unit || genderTotal?.unit || totalPopulation?.unit || '',
  }
}

function formatItem(item) {
  if (!item) return '不明'
  return `${item.code} = ${item.name}${item.unit ? ` [${item.unit}]` : ''}`
}

function printMetadata(metadata) {
  const targets = extractTargets(metadata)
  console.log(`\n=== 必須メタ情報検証: ${metadata.statsDataId} ===`)
  console.log(`統計表名: ${metadata.table.title || '不明'}`)
  console.log(`提供分類1: ${metadata.table.classification1 || '不明'}`)
  console.log(`提供分類2: ${metadata.table.classification2 || '不明'}`)
  console.log(`国勢調査基準: ${detectBasis(metadata.table)}`)
  console.log(`表番号: ${metadata.table.tableNumber || '不明'}`)
  console.log(`公開日: ${metadata.table.openDate || '不明'}`)
  console.log(
    `収録年（${TARGET_YEAR_MIN}～${TARGET_YEAR_MAX}）: ${targets.years.length ? targets.years.map((item) => item.year).join(', ') : '抽出不能'}`,
  )
  if (targets.years.length === 0) {
    console.log('時間分類の全コードと名称:')
    for (const item of targets.timeClass?.items ?? []) console.log(`  ${formatItem(item)}`)
  }

  console.log('分類コード:')
  console.log(`  cdTab: ${formatItem(targets.tabPopulation)}`)
  console.log(`  cdCat01: ${formatItem(targets.genderTotal)}`)
  console.log(`  cdCat02（総人口）: ${formatItem(targets.totalPopulation)}`)
  console.log(`  cdCat02（日本人人口）: ${formatItem(targets.japanesePopulation)}`)
  console.log(`  単位: ${targets.unit || '不明'}`)
  console.log('  cdArea:')
  for (const prefecture of targets.prefectures) {
    console.log(`    ${prefecture.name}: ${formatItem(prefecture.item)}`)
  }
  console.log('  cdTime:')
  for (const year of targets.years) console.log(`    ${year.year}: ${formatItem(year)}`)

  console.log('基準改定・不連続に関する注記:')
  if (metadata.notes.length === 0) {
    console.log('  メタ情報内から自動抽出できず（不明）')
  } else {
    metadata.notes.forEach((note) => console.log(`  - ${note.slice(0, 500)}`))
  }
  return targets
}

function requiredCode(item, label, statsDataId) {
  if (!item?.code) throw new Error(`${statsDataId}: ${label}のコードをメタ情報から特定できません`)
  return item.code
}

async function getComparisonData(metadata, targets) {
  const timeItems = COMPARISON_YEARS.map((year) =>
    targets.years.find((item) => item.year === year),
  ).filter(Boolean)
  if (timeItems.length === 0) {
    console.log(`${metadata.statsDataId}: 比較対象年が収録されていないためデータ取得を省略します。`)
    return []
  }

  const root = await request(
    'getStatsData',
    {
      statsDataId: metadata.statsDataId,
      cdTab: requiredCode(targets.tabPopulation, 'cdTab', metadata.statsDataId),
      cdCat01: requiredCode(targets.genderTotal, 'cdCat01（男女計）', metadata.statsDataId),
      cdCat02: requiredCode(targets.totalPopulation, 'cdCat02（総人口）', metadata.statsDataId),
      cdArea: targets.prefectures
        .map((prefecture) => requiredCode(prefecture.item, `cdArea（${prefecture.name}）`, metadata.statsDataId))
        .join(','),
      cdTime: timeItems.map((item) => item.code).join(','),
      metaGetFlg: 'N',
      cntGetFlg: 'N',
      explanationGetFlg: 'N',
      limit: '100',
      lang: 'J',
    },
    'GET_STATS_DATA',
  )

  return asArray(root?.STATISTICAL_DATA?.DATA_INF?.VALUE).map((value) => ({
    statsDataId: metadata.statsDataId,
    tabCode: String(value?.['@tab'] ?? ''),
    cat01Code: String(value?.['@cat01'] ?? ''),
    cat02Code: String(value?.['@cat02'] ?? ''),
    areaCode: String(value?.['@area'] ?? ''),
    timeCode: String(value?.['@time'] ?? ''),
    unit: text(value?.['@unit']) || targets.unit,
    rawValue: text(value?.$),
  }))
}

function toThousands(rawValue, unit) {
  const numericValue = Number(String(rawValue).replace(/,/g, ''))
  if (!Number.isFinite(numericValue)) return undefined
  const normalizedUnit = normalizeName(unit)
  if (normalizedUnit === '千人') return numericValue
  if (normalizedUnit === '人') return numericValue / 1_000
  if (normalizedUnit === '万人') return numericValue * 10
  return undefined
}

function comparisonRows(inspected) {
  const rows = []
  for (const year of COMPARISON_YEARS) {
    for (const [, prefectureName] of targetPrefectures) {
      const row = { year, prefectureName, tables: {} }
      for (const entry of inspected) {
        const areaCode = entry.targets.prefectures.find(
          (prefecture) => prefecture.name === prefectureName,
        )?.item?.code
        const timeCode = entry.targets.years.find((item) => item.year === year)?.code
        const value = entry.values.find(
          (item) => item.areaCode === areaCode && item.timeCode === timeCode,
        )
        row.tables[entry.metadata.statsDataId] = value
          ? { ...value, thousands: toThousands(value.rawValue, value.unit) }
          : undefined
      }
      rows.push(row)
    }
  }
  return rows
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString('ja-JP', { maximumFractionDigits: 3 }) : '不明'
}

function printComparison(rows) {
  const [firstTable, secondTable] = knownTables.map(({ statsDataId }) => statsDataId)
  console.log('\n=== 重複年の実データ比較 ===')
  console.log(`差 = ${secondTable} - ${firstTable}（単位: 千人）`)
  console.log('年 | 都道府県 | 表ID | 元の値 | 単位 | 千人換算 | 2表の差')
  for (const row of rows) {
    const first = row.tables[firstTable]
    const second = row.tables[secondTable]
    const difference =
      Number.isFinite(first?.thousands) && Number.isFinite(second?.thousands)
        ? second.thousands - first.thousands
        : undefined
    for (const table of knownTables) {
      const value = row.tables[table.statsDataId]
      console.log(
        `${row.year} | ${row.prefectureName} | ${table.statsDataId} | ${value?.rawValue ?? 'データなし'} | ${value?.unit || '不明'} | ${formatNumber(value?.thousands)} | ${formatNumber(difference)}`,
      )
    }
  }
}

async function discoverTables() {
  console.log('\n=== 検索による候補発見（自動選択には使用しない） ===')
  try {
    const root = await request(
      'getStatsList',
      {
        searchWord: '都道府県 AND 男女別人口 AND 総人口',
        statsCode: '00200524',
        searchKind: '1',
        explanationGetFlg: 'N',
        limit: String(SEARCH_RESULT_LIMIT),
        lang: 'J',
      },
      'GET_STATS_LIST',
    )
    const tables = asArray(root?.DATALIST_INF?.TABLE_INF).map(summarizeTable)
    console.log(`検索結果: ${tables.length}件（表示は先頭${DISCOVERY_DISPLAY_LIMIT}件まで）`)
    for (const table of tables.slice(0, DISCOVERY_DISPLAY_LIMIT)) {
      console.log(
        `- [${discoveryStatus(table)}] ${table.id} | ${table.title || '表題不明'} | 提供分類2:${table.classification2 || detectBasis(table)} | 公開:${table.openDate || '不明'}`,
      )
    }
  } catch (error) {
    console.log(`候補検索に失敗しましたが、既知IDの直接検証を継続します: ${error.message}`)
  }
}

async function main() {
  console.log('e-Stat API 3.0 人口推計メタ情報・重複年調査')
  console.log(`対象: ${targetPrefectures.map(([code, name]) => `${code} ${name}`).join(', ')}`)

  if (!appId) {
    console.error('\nESTAT_APP_IDが設定されていません。')
    console.error('.env.exampleを.envへコピーし、値を設定してから再実行してください。')
    console.error('APIリクエストは送信していません。')
    process.exitCode = 1
    return
  }

  await discoverTables()

  console.log('\n=== 既知IDの直接検証 ===')
  const inspected = []
  for (const knownTable of knownTables) {
    console.log(`\n直接検証: ${knownTable.statsDataId} (${knownTable.expected})`)
    const metadata = await getMetadata(knownTable.statsDataId)
    const targets = printMetadata(metadata)
    inspected.push({ metadata, targets, values: [] })
  }

  for (const entry of inspected) {
    entry.values = await getComparisonData(entry.metadata, entry.targets)
  }
  printComparison(comparisonRows(inspected))

  console.log('\n=== 調査結論 ===')
  console.log('検索結果は候補発見だけに使用し、統計表の自動選択には使用していません。')
  console.log(`直接検証したstatsDataId: ${knownTables.map(({ statsDataId }) => statsDataId).join(', ')}`)
  console.log('本番用population.jsonは生成していません。')
}

try {
  await main()
} catch (error) {
  console.error(`\n調査を中止しました: ${error?.message ?? '不明なエラー'}`)
  process.exitCode = 1
} finally {
  console.log(`\nAPIリクエスト回数: ${requestCount}`)
}
