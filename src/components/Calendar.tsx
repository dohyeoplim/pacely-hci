/* Inline month calendar with start-end range selection.

   Designed for the Co-Planning F1 step 2 flow. Pure-React, no calendar lib —
   the spec only needs month-view + range selection. */

import { useMemo, useState } from 'react'

import { toISO, fromISO } from '../lib/util'

interface CalendarProps {
  value?: { start?: string; end?: string }
  onChange: (range: { start: string; end: string }) => void
  /** Inclusive lower bound — picks below this are disabled. */
  minDate?: string
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/** Returns an array of 42 Date cells (6 weeks) starting from Monday. */
function buildGrid(monthAnchor: Date): Date[] {
  const first = startOfMonth(monthAnchor)
  // JS getDay: 0=Sun..6=Sat. We start week on Monday.
  const offset = (first.getDay() + 6) % 7
  const gridStart = new Date(first)
  gridStart.setDate(first.getDate() - offset)

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
}

export function Calendar({ value, onChange, minDate }: CalendarProps) {
  const [anchor, setAnchor] = useState(() => {
    if (value?.start) return startOfMonth(fromISO(value.start))
    return startOfMonth(new Date())
  })

  const [draftStart, setDraftStart] = useState<string | undefined>(value?.start)
  const [draftEnd, setDraftEnd] = useState<string | undefined>(value?.end)

  const grid = useMemo(() => buildGrid(anchor), [anchor])
  const month = anchor.getMonth()

  const handlePick = (iso: string) => {
    if (minDate && iso < minDate) return
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(iso)
      setDraftEnd(undefined)
      return
    }
    if (iso < draftStart) {
      setDraftStart(iso)
      return
    }
    setDraftEnd(iso)
    onChange({ start: draftStart, end: iso })
  }

  return (
    <div className="calendar">
      <header className="calendar__head">
        <button
          className="calendar__nav"
          onClick={() =>
            setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))
          }
          aria-label="이전 달"
        >
          <Chevron dir="left" />
        </button>
        <div className="calendar__title">
          {anchor.getFullYear()}년 {month + 1}월
        </div>
        <button
          className="calendar__nav"
          onClick={() =>
            setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))
          }
          aria-label="다음 달"
        >
          <Chevron dir="right" />
        </button>
      </header>

      <div className="calendar__weekdays">
        {WEEKDAYS.map((w, i) => (
          <span
            key={w}
            className={`calendar__weekday ${i >= 5 ? 'calendar__weekday--weekend' : ''}`}
          >
            {w}
          </span>
        ))}
      </div>

      <div className="calendar__grid">
        {grid.map((d) => {
          const iso = toISO(d)
          const inMonth = d.getMonth() === month
          const isStart = iso === draftStart
          const isEnd = iso === draftEnd
          const inRange =
            draftStart &&
            draftEnd &&
            iso >= draftStart &&
            iso <= draftEnd
          const isWeekend = d.getDay() === 0 || d.getDay() === 6
          const disabled = !!minDate && iso < minDate

          const cls = [
            'calendar__cell',
            !inMonth ? 'calendar__cell--muted' : '',
            inRange ? 'calendar__cell--in-range' : '',
            isStart ? 'calendar__cell--start' : '',
            isEnd ? 'calendar__cell--end' : '',
            isWeekend ? 'calendar__cell--weekend' : '',
            disabled ? 'calendar__cell--disabled' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button
              key={iso}
              className={cls}
              onClick={() => handlePick(iso)}
              disabled={disabled}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  const path = dir === 'left' ? 'M11 3 L4 9 L11 15' : 'M4 3 L11 9 L4 15'
  return (
    <svg width="14" height="18" viewBox="0 0 14 18" fill="none" aria-hidden>
      <path
        d={path}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Validate a draft range. */
export function rangeIsValid(r: { start?: string; end?: string }): boolean {
  return !!(r.start && r.end && r.end > r.start)
}

/** Inclusive day count between two ISO dates. */
export function rangeDays(start: string, end: string): number {
  return Math.round(
    (fromISO(end).getTime() - fromISO(start).getTime()) / 86_400_000,
  ) + 1
}

