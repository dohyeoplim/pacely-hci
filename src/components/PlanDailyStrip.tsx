/* Horizontal "이번 주 일정" strip — shown beneath the plan card in the
   planning preview step. Lets the user feel what each day looks like before
   committing to the plan. */

import type { Plan } from '../types'
import { fromISO } from '../lib/util'

const WEEKDAYS_SHORT = ['일', '월', '화', '수', '목', '금', '토']

interface PlanDailyStripProps {
  plan: Plan
  /** how many days to show, default 7 */
  windowSize?: number
}

export function PlanDailyStrip({ plan, windowSize = 7 }: PlanDailyStripProps) {
  const days = plan.dailyAllocation.slice(0, windowSize)
  const subjects = plan.subjects
  const focus = (i: number) =>
    subjects.length > 0 ? subjects[i % subjects.length] : null

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
          return (
            <li key={d.date} className={`plan-strip__day plan-strip__day--phase-${d.phase}`}>
              <div className="plan-strip__weekday">{wd}</div>
              <div className="plan-strip__dayn">{dayN}</div>
              <div className="plan-strip__hours">{d.hours}h</div>
              {focusSubject && (
                <div className="plan-strip__focus" title={focusSubject}>
                  {focusSubject}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
