import { clamp } from '../lib/util'

interface HourPickerProps {
  value: number
  min?: number
  max?: number
  onChange: (v: number) => void
}

const SUBDIV = 4 // ticks between integers

function visibleLabelHours(min: number, max: number, value: number): number[] {
  const span = max - min
  const stride = span <= 7 ? 1 : span <= 10 ? 2 : 3
  const out = new Set<number>([min, max, value])
  for (let h = min; h <= max; h += stride) out.add(h)
  return Array.from(out).sort((a, b) => a - b)
}

export function HourPicker({
  value,
  min = 1,
  max = 14,
  onChange,
}: HourPickerProps) {
  const step = (dir: 1 | -1) => onChange(clamp(value + dir, min, max))
  const ticks = Array.from(
    { length: (max - min) * SUBDIV + 1 },
    (_, i) => min + i / SUBDIV,
  )

  return (
    <div className="hour-picker">
      <div className="hour-picker__display">
        <button
          className="hour-picker__step"
          aria-label="줄이기"
          onClick={() => step(-1)}
        >
          –
        </button>
        <div className="hour-picker__value">
          {value}
          <span className="hour-picker__unit">시간</span>
        </div>
        <button
          className="hour-picker__step"
          aria-label="늘리기"
          onClick={() => step(1)}
        >
          +
        </button>
      </div>

      <div className="hour-picker__ruler">
        <div className="hour-picker__ticks">
          {ticks.map((t, i) => {
            const isMajor = Number.isInteger(t)
            const isCenter = i === Math.round((value - min) * SUBDIV)
            return (
              <span
                key={i}
                className={[
                  'hour-picker__tick',
                  isMajor ? 'hour-picker__tick--major' : '',
                  isCenter ? 'hour-picker__tick--center' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            )
          })}
        </div>
        <div className="hour-picker__labels">
          {visibleLabelHours(min, max, value).map((h) => (
            <button
              key={h}
              className={`hour-picker__label ${h === value ? 'hour-picker__label--active' : ''}`}
              onClick={() => onChange(h)}
            >
              {h}h
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
