import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { PopulationData } from './types'

const sampleData: PopulationData = {
  metadata: {
    title: '都道府県人口推移（画面確認用）',
    isSample: true,
    notice: 'このデータは架空のサンプルデータです。',
    unit: '千人',
    startYear: 2015,
    endYear: 2016,
  },
  prefectures: [
    { code: '01', name: '北海道', values: [100, 99] },
    { code: '13', name: '東京都', values: [200, 201] },
    { code: '27', name: '大阪府', values: [150, 149] },
    { code: '40', name: '福岡県', values: [120, 121] },
    { code: '47', name: '沖縄県', values: [80, 81] },
  ],
}

afterEach(() => vi.restoreAllMocks())

describe('App', () => {
  it('サンプルデータを読み込み、対象都道府県と注意を表示する', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(sampleData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(<App />)

    expect(screen.getByRole('heading', { name: '都道府県人口推移', level: 1 })).toBeInTheDocument()
    expect(await screen.findByText('北海道')).toBeInTheDocument()
    for (const prefecture of sampleData.prefectures) {
      expect(screen.getByText(prefecture.name)).toBeInTheDocument()
    }
    expect(screen.getByText(sampleData.metadata.notice)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /5都道府県の人口推移/ })).toBeInTheDocument()
  })

  it('データ取得に失敗した場合はエラーを表示する', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }))
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('データを読み込めませんでした')
    })
  })
})
