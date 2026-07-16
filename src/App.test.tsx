import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { populationFixture } from './test/populationFixture'

function mockPopulationResponse(data: unknown = populationFixture) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('App', () => {
  it('URLから都道府県と指標を復元し、本番形式のデータとmetadataを表示する', async () => {
    window.history.replaceState(null, '', '/?prefs=01,13&metric=index')
    mockPopulationResponse()

    render(<App />)

    expect(await screen.findByRole('heading', { name: '人口推移を比較' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /北海道/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /東京都/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /大阪府/ })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /指数/ })).toBeChecked()
    expect(screen.getByText('2026/07/15 21:34')).toBeInTheDocument()
    expect(screen.getAllByText('0004021102').length).toBeGreaterThan(0)
    expect(screen.getByText('0003448232')).toBeInTheDocument()
  })

  it('選択変更をreplaceStateでURLへ反映する', async () => {
    const user = userEvent.setup()
    mockPopulationResponse()
    render(<App />)

    await screen.findByRole('heading', { name: '人口推移を比較' })
    await user.click(screen.getByRole('checkbox', { name: /大阪府/ }))

    await waitFor(() => {
      expect(window.location.search).toBe('?prefs=01,13,40,47&metric=population')
    })
  })

  it('不正なURLクエリを既定値へ補正する', async () => {
    window.history.replaceState(null, '', '/?prefs=01,99&metric=unknown')
    mockPopulationResponse()
    render(<App />)

    await screen.findByRole('heading', { name: '人口推移を比較' })
    for (const name of ['北海道', '東京都', '大阪府', '福岡県', '沖縄県']) {
      expect(screen.getByRole('checkbox', { name: new RegExp(name) })).toBeChecked()
    }
    expect(screen.getByRole('radio', { name: /人口実数/ })).toBeChecked()
    expect(window.location.search).toBe('?prefs=01,13,27,40,47&metric=population')
  })

  it('HTTPエラー時は取得失敗を表示する', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }))
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('人口データを取得できませんでした')
  })

  it('不正なデータではデータ形式のエラーを表示する', async () => {
    mockPopulationResponse({ metadata: {}, records: [] })
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('データ形式が不正です')
  })
})
