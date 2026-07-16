import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { populationFixture } from '../test/populationFixture'
import { calculatePopulationMetrics } from '../utils/populationMetrics'
import { CsvDownloadButton } from './CsvDownloadButton'

const records = calculatePopulationMetrics(populationFixture.records)
const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:population-csv')
const revokeObjectURL = vi.fn<(url: string) => void>()

beforeEach(() => {
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
})

describe('CsvDownloadButton', () => {
  it('出力対象、期間、元データの単位を表示する', () => {
    render(
      <CsvDownloadButton
        metadata={populationFixture.metadata}
        records={records}
        selected={['01', '13']}
      />,
    )
    expect(screen.getByText(/選択中の都道府県のみ/)).toHaveTextContent('2015年から2016年')
    expect(screen.getByText(/選択中の都道府県のみ/)).toHaveTextContent('元データは千人単位')
  })

  it('CSVをダウンロードしてBlob URLを解放する', async () => {
    const user = userEvent.setup()
    render(
      <CsvDownloadButton
        metadata={populationFixture.metadata}
        records={records}
        selected={['01']}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'CSVダウンロード' }))

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:population-csv')
  })

  it('ダウンロード処理の失敗を画面に表示する', async () => {
    const user = userEvent.setup()
    createObjectURL.mockImplementationOnce(() => {
      throw new Error('failed')
    })
    render(
      <CsvDownloadButton
        metadata={populationFixture.metadata}
        records={records}
        selected={['01']}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'CSVダウンロード' }))
    expect(screen.getByRole('alert')).toHaveTextContent('CSVを生成できませんでした')
  })
})
