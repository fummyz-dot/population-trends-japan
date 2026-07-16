import type { MetricType } from '../types/population'
import { METRICS } from '../utils/populationMetrics'

interface MetricSelectorProps {
  metric: MetricType
  onChange: (metric: MetricType) => void
}

export function MetricSelector({ metric, onChange }: MetricSelectorProps) {
  return (
    <fieldset className="control-group">
      <legend>表示指標</legend>
      <div className="metric-options">
        {METRICS.map((item) => (
          <label className="metric-option" key={item.type} htmlFor={`metric-${item.type}`}>
            <input
              id={`metric-${item.type}`}
              type="radio"
              name="metric"
              value={item.type}
              checked={metric === item.type}
              onChange={() => onChange(item.type)}
            />
            <span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
