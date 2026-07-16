import type { PrefectureCode } from '../types/population'
import { PREFECTURES } from '../utils/populationMetrics'

interface PrefectureSelectorProps {
  selected: PrefectureCode[]
  onToggle: (code: PrefectureCode) => void
}

export function PrefectureSelector({ selected, onToggle }: PrefectureSelectorProps) {
  return (
    <fieldset className="control-group">
      <legend>都道府県</legend>
      <div className="prefecture-options">
        {PREFECTURES.map((prefecture) => {
          const checked = selected.includes(prefecture.code)
          return (
            <label className="check-chip" key={prefecture.code} htmlFor={`pref-${prefecture.code}`}>
              <input
                id={`pref-${prefecture.code}`}
                type="checkbox"
                checked={checked}
                disabled={checked && selected.length === 1}
                onChange={() => onToggle(prefecture.code)}
              />
              <span
                className="color-dot"
                style={{ backgroundColor: prefecture.color }}
                aria-hidden="true"
              />
              <span className="prefecture-code">{prefecture.code}</span>
              <span>{prefecture.name}</span>
            </label>
          )
        })}
      </div>
      <p className="control-hint">比較する地域を選択してください（最低1件）。</p>
    </fieldset>
  )
}
