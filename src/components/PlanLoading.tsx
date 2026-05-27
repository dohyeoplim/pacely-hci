import { useEffect, useState } from 'react'

const DURATION_MS = 25_000
const CAP_PCT = 95

export function PlanLoading() {
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const id = window.setInterval(() => {
      const elapsed = Date.now() - start
      setPct(Math.min(CAP_PCT, (elapsed / DURATION_MS) * 100))
    }, 100)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="plan-loading">
      <div className="plan-loading__head">
        <span className="plan-loading__label">플랜을 그리는 중이에요</span>
        <span className="plan-loading__pct">{Math.round(pct)}%</span>
      </div>
      <div className="plan-loading__bar">
        <span
          className="plan-loading__fill"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
