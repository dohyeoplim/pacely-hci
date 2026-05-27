import { useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { BackButton } from '../components/BackButton'
import { Button } from '../components/Button'
import { usePacely } from '../lib/store/store'
import { daysBetween, formatHours, fromISO } from '../lib/util'

const STATUS_COPY = {
  finished: { label: '완주', tone: 'won' as const },
  abandoned: { label: '중단', tone: 'lost' as const },
  active: { label: '진행 중', tone: 'active' as const },
} as const

export function HistoryPage() {
  const navigate = useNavigate()
  const { state, switchGoal } = usePacely()

  const past = useMemo(
    () => state.goals.filter((g) => g.status !== 'active'),
    [state.goals],
  )
  const active = useMemo(
    () => state.goals.filter((g) => g.status === 'active'),
    [state.goals],
  )

  if (state.goals.length === 0) return <Navigate to="/welcome" replace />

  return (
    <div className="page history-page">
      <header className="day-start__top">
        <BackButton />
      </header>

      <div className="record-head">
        <h1 className="t-title-lg">지난 목표</h1>
        <p className="t-caption">함께 달려온 흔적이에요.</p>
      </div>

      {active.length > 1 && (
        <section className="history-section">
          <h2 className="t-title">진행 중인 다른 목표</h2>
          <ul className="history-list">
            {active
              .filter((g) => g.id !== state.currentGoalId)
              .map((g) => (
                <li key={g.id} className="history-card">
                  <div className="history-card__head">
                    <span className="battle-tag battle-tag--active">진행 중</span>
                    <span className="t-caption">
                      {fromISO(g.startDate).getMonth() + 1}.{fromISO(g.startDate).getDate()}
                      {' ~ '}
                      {fromISO(g.endDate).getMonth() + 1}.{fromISO(g.endDate).getDate()}
                    </span>
                  </div>
                  <div className="history-card__title">{g.title}</div>
                  <div className="t-caption">
                    완료율 {Math.round(g.progress.adherenceRate * 100)}% ·{' '}
                    {formatHours(g.progress.totalHours)} 누적
                  </div>
                  <Button
                    block
                    variant="secondary"
                    onClick={() => {
                      switchGoal(g.id)
                      navigate('/home')
                    }}
                  >
                    이 목표로 전환
                  </Button>
                </li>
              ))}
          </ul>
        </section>
      )}

      <section className="history-section">
        <h2 className="t-title">완료한 목표</h2>
        {past.length === 0 ? (
          <p className="record-empty t-caption">
            아직 완료한 목표가 없어요. 첫 완주를 기다리고 있어요.
          </p>
        ) : (
          <ul className="history-list">
            {past.map((g) => {
              const totalDays = daysBetween(g.startDate, g.endDate) + 1
              const meta = STATUS_COPY[g.status]
              return (
                <li key={g.id} className="history-card">
                  <div className="history-card__head">
                    <span className={`battle-tag battle-tag--${meta.tone}`}>
                      {meta.label}
                    </span>
                    <span className="t-caption">{totalDays}일</span>
                  </div>
                  <div className="history-card__title">{g.title}</div>
                  <dl className="history-card__stats">
                    <Row k="완주율" v={`${Math.round(g.progress.adherenceRate * 100)}%`} />
                    <Row
                      k="총 학습시간"
                      v={formatHours(g.progress.totalHours)}
                    />
                    <Row
                      k="최장 연속"
                      v={`${g.progress.bestStreak}일`}
                    />
                  </dl>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="history-card__stat">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}
