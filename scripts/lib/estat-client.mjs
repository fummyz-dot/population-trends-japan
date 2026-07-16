const API_BASE = 'https://api.e-stat.go.jp/rest/3.0/app/json'
const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_RETRIES = 3

export class HttpError extends Error {
  constructor(status, statusText) {
    super(`HTTPエラー: ${status} ${statusText}`)
    this.name = 'HttpError'
    this.status = status
  }
}

export class EstatApiError extends Error {
  constructor(status, message, httpStatus) {
    super(`e-Stat APIエラー: STATUS=${status}, HTTP=${httpStatus}, ${message}`)
    this.name = 'EstatApiError'
    this.status = status
  }
}

export class TimeoutError extends Error {
  constructor(timeoutMs) {
    super(`タイムアウト: ${timeoutMs}ms以内に応答がありませんでした`)
    this.name = 'TimeoutError'
  }
}

export class NetworkError extends Error {
  constructor(code, cause) {
    super(`通信エラー: ${code}`, { cause })
    this.name = 'NetworkError'
  }
}

function text(value) {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && '$' in value) return text(value.$)
  return ''
}

function maskedUrl(url) {
  const safeUrl = new URL(url)
  if (safeUrl.searchParams.has('appId')) safeUrl.searchParams.set('appId', '***')
  return safeUrl.toString()
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export function createEstatClient({
  appId,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRetries = DEFAULT_MAX_RETRIES,
  fetchImpl = globalThis.fetch,
  logger = console,
} = {}) {
  if (!appId?.trim()) throw new Error('ESTAT_APP_IDが設定されていません')
  if (typeof fetchImpl !== 'function') throw new Error('fetchが利用できません')

  let requestCount = 0

  async function request(endpoint, params, rootName) {
    const url = new URL(`${API_BASE}/${endpoint}`)
    url.search = new URLSearchParams({ appId: appId.trim(), ...params }).toString()
    requestCount += 1
    logger.log(`[e-Stat ${requestCount}] ${maskedUrl(url)}`)

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let response

      try {
        response = await fetchImpl(url, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
      } catch (error) {
        if (error?.name === 'AbortError') throw new TimeoutError(timeoutMs)
        throw new NetworkError(error?.cause?.code ?? error?.code ?? error?.name ?? 'unknown', error)
      } finally {
        clearTimeout(timer)
      }

      const bodyText = await response.text()
      const retryable = response.status === 429 || response.status >= 500
      if (retryable && attempt < maxRetries) {
        const delayMs = 500 * 2 ** attempt
        logger.warn(
          `HTTP ${response.status}のため${delayMs}ms後に再試行します (${attempt + 1}/${maxRetries})`,
        )
        await wait(delayMs)
        continue
      }

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
      return root
    }

    throw new Error('リトライ処理が予期せず終了しました')
  }

  return {
    get requestCount() {
      return requestCount
    },
    getStatsData(params) {
      return request('getStatsData', params, 'GET_STATS_DATA')
    },
  }
}
