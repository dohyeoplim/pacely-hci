import { useEffect, useRef, useState } from 'react'

import { Button } from './Button'

type PlanLoadingStatus = 'running' | 'completing' | 'timeout'

interface PlanLoadingProps {
  status: PlanLoadingStatus
  onRetry?: () => void
}

const FILL_DURATION_MS = 25_000
const CAP_PCT = 99
const SOFT_CAP_PCT = 95

export function PlanLoading({ status, onRetry }: PlanLoadingProps) {
  const [pct, setPct] = useState(0)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (status !== 'running') return
    startRef.current = Date.now()
    const id = window.setInterval(() => {
      const elapsed = Date.now() - (startRef.current ?? Date.now())
      let next: number
      if (elapsed < FILL_DURATION_MS) {
        next = (elapsed / FILL_DURATION_MS) * SOFT_CAP_PCT
      } else {
        const overflow = Math.min(1, (elapsed - FILL_DURATION_MS) / 10_000)
        next = SOFT_CAP_PCT + overflow * (CAP_PCT - SOFT_CAP_PCT)
      }
      setPct(Math.min(CAP_PCT, next))
    }, 100)
    return () => window.clearInterval(id)
  }, [status])

  useEffect(() => {
    if (status === 'completing') setPct(100)
  }, [status])

  if (status === 'timeout') {
    return (
      <div className="plan-loading plan-loading--timeout">
        <div className="plan-loading__head">
          <span className="plan-loading__label">시간이 평소보다 오래 걸려요</span>
          <span className="plan-loading__pct">99%</span>
        </div>
        <div className="plan-loading__bar">
          <span className="plan-loading__fill" style={{ width: '99%' }} />
        </div>
        <p className="t-caption">
          네트워크 상태에 따라 가끔 끊길 수 있어요. 다시 시도해 주세요.
        </p>
        {onRetry && (
          <Button block onClick={onRetry}>
            다시 시도하기
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="plan-loading">
      <div className="plan-loading__head">
        <span className="plan-loading__label">
          {status === 'completing' ? '거의 다 됐어요' : '플랜을 그리는 중이에요'}
        </span>
        <span className="plan-loading__pct">{Math.round(pct)}%</span>
      </div>
      <div className="plan-loading__bar">
        <span className="plan-loading__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
