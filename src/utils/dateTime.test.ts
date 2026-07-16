import { describe, expect, it } from 'vitest'
import { formatDateTime } from './dateTime'

describe('formatDateTime', () => {
  it('日時をAsia/Tokyoの年月日時分に整形する', () => {
    expect(formatDateTime('2026-07-15T12:34:56.000Z')).toBe('2026/07/15 21:34')
  })

  it('日付をまたぐ場合もAsia/Tokyoで整形する', () => {
    expect(formatDateTime('2026-07-15T15:01:00.000Z')).toBe('2026/07/16 00:01')
  })

  it('不正な日時は安全な表示にする', () => {
    expect(formatDateTime('invalid-date')).toBe('不明')
  })
})
