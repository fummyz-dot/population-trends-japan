import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { PrefectureCode } from '../types/population'
import { PrefectureSelector } from './PrefectureSelector'

function SelectorHarness({ initial }: { initial: PrefectureCode[] }) {
  const [selected, setSelected] = useState(initial)
  return (
    <PrefectureSelector
      selected={selected}
      onToggle={(code) =>
        setSelected((current) =>
          current.includes(code)
            ? current.length === 1
              ? current
              : current.filter((item) => item !== code)
            : [...current, code],
        )
      }
    />
  )
}

describe('PrefectureSelector', () => {
  it('都道府県の選択を切り替える', async () => {
    const user = userEvent.setup()
    render(<SelectorHarness initial={['01', '13']} />)
    const tokyo = screen.getByRole('checkbox', { name: /東京都/ })
    await user.click(tokyo)
    expect(tokyo).not.toBeChecked()
  })

  it('最後の1都道府県は解除できない', async () => {
    const user = userEvent.setup()
    render(<SelectorHarness initial={['01']} />)
    const hokkaido = screen.getByRole('checkbox', { name: /北海道/ })
    expect(hokkaido).toBeDisabled()
    await user.click(hokkaido)
    expect(hokkaido).toBeChecked()
  })
})
