/* Horizontal "이번 주 일정" strip — shown beneath the plan card in the
   planning preview step. Each day card is tappable so the user can drill
   into and edit that day's sub-tasks before committing to the plan. */

import type { MissionTask, Plan } from '../types'
import { fromISO } from '../lib/util'

const WEEKDAYS_SHORT = ['일', '월', '화', '수', '목', '금', '토']

interface PlanDailyStripProps {
  plan: Plan
  /** how many days to show, default 7 */
  windowSize?: number
  /** Optional draft missions used to surface a per-day count badge. */
  missions?: MissionTask[]
  /** Tap a day cell to open its detail / edit view. */
  onPickDay?: (date: string) => void
}

export function PlanDailyStrip({
  plan,
  windowSize = 7,
  missions,
  onPickDay,
}: PlanDailyStripProps) {
  const days = plan.dailyAllocation.slice(0, windowSize)
  const subjects = plan.subjects
  const focus = (i: number) =>
    subjects.length > 0 ? subjects[i % subjects.length] : null

  const countFor = (date: string): number | null => {
    if (!missions) return null
    return missions.filter((m) => m.date === date).length
  }

  return (
    <div className="plan-strip">
      <div className="plan-strip__head">
        <span className="t-caption">이번 주 일정 미리보기</span>
        <span className="t-micro">{plan.weeks}주 플랜 · 처음 {days.length}일</span>
      </div>
      <ol className="plan-strip__list">
        {days.map((d, i) => {
          const date = fromISO(d.date)
          const wd = WEEKDAYS_SHORT[date.getDay()]
          const dayN = date.getDate()
          const focusSubject = focus(i)
          const count = countFor(d.date)
          const Tag: 'button' | 'li' = onPickDay ? 'button' : 'li'
          const inner = (
            <>
              <div className="plan-strip__weekday">{wd}</div>
              <div className="plan-strip__dayn">{dayN}</div>
              <div className="plan-strip__hours">{d.hours}h</div>
              {focusSubject && (
                <div className="plan-strip__focus" title={focusSubject}>
                  {focusSubject}
                </div>
              )}
              {count !== null && (
                <div className="plan-strip__count" aria-label={`${count}개 작업`}>
                  {count}개
                </div>
              )}
            </>
          )
          if (Tag === 'button') {
            return (
              <li key={d.date}>
                <button
                  type="button"
                  className={`plan-strip__day plan-strip__day--phase-${d.phase} plan-strip__day--tappable`}
                  onClick={() => onPickDay?.(d.date)}
                  aria-label={`${dayN}일 작업 편집`}
                >
                  {inner}
                </button>
              </li>
            )
          }
          return (
            <li
              key={d.date}
              className={`plan-strip__day plan-strip__day--phase-${d.phase}`}
            >
              {inner}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
