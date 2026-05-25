/* Tap-driven hour picker (1–7h per spec F1.3).

   The Figma frame shows a fine-tick ruler — we render that visually with
   subdivision ticks while keeping selection on whole-hour steps. */

import { clamp } from '../lib/util'

interface HourPickerProps {
  value: number
  min?: number
  max?: number
  onChange: (v: number) => void
}

const SUBDIV = 4 // ticks between integers

export function HourPicker({
  value,
  min = 1,
  max = 7,
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
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((h) => (
            <button
              key={h}
              className={`hour-picker__label ${h === value ? 'hour-picker__label--active' : ''}`}
              onClick={() => onChange(h)}
            >
              {h}:00
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
