import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { MissionList } from '../components/MissionList'
import { usePacely } from '../lib/store/store'
import { fromISO, toISO, todayISO } from '../lib/util'
import type { DailyAllocation } from '../types'

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

type View = 'month' | 'week'

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

// Monday-based 42-cell month grid (mirrors the planning Calendar).
function monthGrid(anchor: Date): Date[] {
  const first = startOfMonth(anchor)
  const offset = (first.getDay() + 6) % 7
  const gridStart = new Date(first)
  gridStart.setDate(first.getDate() - offset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
}

// Monday-based 7-cell week containing the anchor date.
function weekGrid(anchor: Date): Date[] {
  const offset = (anchor.getDay() + 6) % 7
  const start = new Date(anchor)
  start.setDate(anchor.getDate() - offset)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export function CalendarPage() {
  const { currentGoal, toggleMission } = usePacely()
  const today = todayISO()
  const [view, setView] = useState<View>('month')
  const [anchor, setAnchor] = useState(() => startOfMonth(fromISO(today)))
  const [selected, setSelected] = useState<string>(today)

  // date -> { allocation, total, done } for fast per-cell lookup.
  const byDate = useMemo(() => {
    const map = new Map<
      string,
      { allocation?: DailyAllocation; total: number; done: number }
    >()
    if (!currentGoal) return map
    for (const d of currentGoal.plan.dailyAllocation) {
      map.set(d.date, { allocation: d, total: 0, done: 0 })
    }
    for (const m of currentGoal.missions) {
      const entry = map.get(m.date) ?? { total: 0, done: 0 }
      entry.total += 1
      if (m.completed) entry.done += 1
      map.set(m.date, entry)
    }
    return map
  }, [currentGoal])

  if (!currentGoal) return <Navigate to="/welcome" replace />

  const cells = view === 'month' ? monthGrid(anchor) : weekGrid(fromISO(selected))
  const monthLabel = `${anchor.getFullYear()}년 ${anchor.getMonth() + 1}월`
  const selectedMissions = currentGoal.missions.filter((m) => m.date === selected)
  const selectedAlloc = byDate.get(selected)?.allocation
  const selDate = fromISO(selected)

  const shiftMonth = (delta: number) =>
    setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1))
  const shiftWeek = (delta: number) => {
    const d = fromISO(selected)
    d.setDate(d.getDate() + delta * 7)
    setSelected(toISO(d))
  }

  return (
    <div className="page calendar-page">
      <header className="record-head">
        <h1 className="t-title-lg">캘린더</h1>
        <p className="t-caption">{currentGoal.title}</p>
      </header>

      <div className="cal-toggle" role="tablist" aria-label="보기 전환">
        <button
          role="tab"
          aria-selected={view === 'month'}
          className={`cal-toggle__btn ${view === 'month' ? 'cal-toggle__btn--on' : ''}`}
          onClick={() => setView('month')}
        >
          월간
        </button>
        <button
          role="tab"
          aria-selected={view === 'week'}
          className={`cal-toggle__btn ${view === 'week' ? 'cal-toggle__btn--on' : ''}`}
          onClick={() => setView('week')}
        >
          주간
        </button>
      </div>

      <div className="cal-nav">
        <button
          className="cal-nav__btn"
          onClick={() => (view === 'month' ? shiftMonth(-1) : shiftWeek(-1))}
          aria-label="이전"
        >
          ‹
        </button>
        <span className="cal-nav__label">
          {view === 'month'
            ? monthLabel
            : `${selDate.getMonth() + 1}월 ${selDate.getDate()}일 주`}
        </span>
        <button
          className="cal-nav__btn"
          onClick={() => (view === 'month' ? shiftMonth(1) : shiftWeek(1))}
          aria-label="다음"
        >
          ›
        </button>
      </div>

      <div className="cal-grid-head">
        {WEEKDAYS.map((w) => (
          <span key={w} className="cal-grid-head__cell">
            {w}
          </span>
        ))}
      </div>

      <div className={`cal-grid ${view === 'week' ? 'cal-grid--week' : ''}`}>
        {cells.map((d) => {
          const iso = toISO(d)
          const entry = byDate.get(iso)
          const inPlan = !!entry?.allocation
          const inMonth = view === 'week' || d.getMonth() === anchor.getMonth()
          const ratio = entry && entry.total ? entry.done / entry.total : 0
          const isToday = iso === today
          const isSel = iso === selected
          return (
            <button
              key={iso}
              className={[
                'cal-cell',
                inPlan ? 'cal-cell--plan' : '',
                inMonth ? '' : 'cal-cell--dim',
                isToday ? 'cal-cell--today' : '',
                isSel ? 'cal-cell--sel' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setSelected(iso)}
            >
              <span className="cal-cell__num">{d.getDate()}</span>
              {inPlan && (
                <span className="cal-cell__bar" aria-hidden>
                  <span
                    className="cal-cell__bar-fill"
                    style={{ width: `${ratio * 100}%` }}
                  />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <section className="cal-day">
        <div className="cal-day__head">
          <h2 className="t-title">
            {selDate.getMonth() + 1}월 {selDate.getDate()}일 ({WEEKDAYS[(selDate.getDay() + 6) % 7]})
          </h2>
          {selectedAlloc && (
            <span className="t-caption">
              {selectedAlloc.hours}h · {selectedMissions.filter((m) => m.completed).length}/
              {selectedMissions.length} 완료
            </span>
          )}
        </div>
        {selectedAlloc?.summary && (
          <div className="cal-day__summary t-caption">{selectedAlloc.summary}</div>
        )}
        {selectedMissions.length > 0 ? (
          <MissionList
            missions={selectedMissions}
            onToggle={
              selected === today ? (id: string) => void toggleMission(id) : undefined
            }
            readOnly={selected !== today}
          />
        ) : (
          <div className="cal-day__empty t-caption">
            {inPlanRange(currentGoal.plan.dailyAllocation, selected)
              ? '이 날의 미션이 아직 없어요.'
              : '계획 기간이 아니에요.'}
          </div>
        )}
      </section>
    </div>
  )
}

function inPlanRange(allocation: DailyAllocation[], iso: string): boolean {
  if (allocation.length === 0) return false
  return iso >= allocation[0].date && iso <= allocation[allocation.length - 1].date
}
