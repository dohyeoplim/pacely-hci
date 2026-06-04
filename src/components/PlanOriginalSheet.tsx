import { Sheet } from './Sheet'
import { fromISO } from '../lib/util'
import type { Plan } from '../types'

interface PlanOriginalSheetProps {
  open: boolean
  original: Plan
  onClose: () => void
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function shortDate(iso: string): string {
  const d = fromISO(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${WEEKDAYS[d.getDay()]}`
}

/* Read-only look at Pacely's first auto-generated plan, so the user can see
   how it was structured before their edits. */
export function PlanOriginalSheet({
  open,
  original,
  onClose,
}: PlanOriginalSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      analyticsName="plan_original"
      title="페이슬리의 원래 계획"
    >
      <div className="plan-original">
        <p className="t-micro plan-original__note">
          내가 수정하기 전, Pacely가 처음 짠 {original.weeks}주 계획이에요.
        </p>

        <section className="plan-original__section">
          <div className="t-caption">마일스톤</div>
          <ul className="plan-original__milestones">
            {original.milestones.map((m) => (
              <li key={m.id} className="plan-original__milestone">
                <div className="plan-original__milestone-title">{m.title}</div>
                <div className="t-micro">{m.cadence}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="plan-original__section">
          <div className="t-caption">일별 흐름</div>
          <ul className="plan-original__days">
            {original.dailyAllocation.map((d) => (
              <li key={d.date} className="plan-original__day">
                <span className="plan-original__day-date t-micro">
                  {shortDate(d.date)}
                </span>
                <span className="plan-original__day-summary">{d.summary}</span>
                <span className="plan-original__day-hours t-micro">
                  {d.hours}h
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Sheet>
  )
}
