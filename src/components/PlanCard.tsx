import type { Plan } from '../types'

interface PlanCardProps {
  plan: Plan
  goalTitle: string
}

export function PlanCard({ plan, goalTitle }: PlanCardProps) {
  return (
    <div className="plan-card">
      <header className="plan-card__head">
        <div className="plan-card__title t-title">
          당신을 위한 Pacely의 {plan.weeks}주 플랜
        </div>
        <div className="plan-card__subtitle t-caption">{goalTitle}</div>
      </header>
      <ul className="plan-card__list">
        {plan.milestones.map((m) => (
          <li key={m.id} className="plan-card__item">
            <span className="plan-card__bullet" aria-hidden />
            <div className="plan-card__item-text">
              <div className="plan-card__item-title">{m.title}</div>
              <div className="plan-card__item-cadence">{m.cadence}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
