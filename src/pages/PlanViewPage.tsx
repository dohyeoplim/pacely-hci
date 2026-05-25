/* /plan — Revisits the full plan after the goal has started.

   Shows: header with goal title (tap-to-edit), the original plan card with
   milestones, and a vertical list of every planned day with subjects + hours
   so the user can see the full arc, not just today. */

import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { BackButton } from '../components/BackButton'
import { Button } from '../components/Button'
import { DDayBadge } from '../components/DDayBadge'
import { PlanCard } from '../components/PlanCard'
import { Sheet } from '../components/Sheet'
import { usePacely } from '../lib/store/store'
import { dDay, daysBetween, fromISO, todayISO } from '../lib/util'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export function PlanViewPage() {
  const navigate = useNavigate()
  const { currentGoal, editGoalTitle } = usePacely()
  const [renameOpen, setRenameOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')

  if (!currentGoal) return <Navigate to="/welcome" replace />

  const today = todayISO()
  const remaining = dDay(currentGoal.endDate)
  const elapsed = daysBetween(currentGoal.startDate, today) + 1

  const focusFor = (idx: number): string | null => {
    const subjects = currentGoal.plan.subjects
    if (subjects.length === 0) return null
    return subjects[idx % subjects.length]
  }

  return (
    <div className="page plan-view-page">
      <header className="day-start__top">
        <BackButton />
      </header>

      <section className="plan-view__head">
        <div className="t-caption">진행 중인 플랜</div>
        <button
          className="plan-view__title"
          onClick={() => {
            setDraftTitle(currentGoal.title)
            setRenameOpen(true)
          }}
        >
          <span>{currentGoal.title}</span>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path
              d="M9 1.5 L12.5 5 L4 13.5 L0.5 14 L1 10.5 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="plan-view__meta">
          <DDayBadge days={remaining} />
          <span className="t-caption">
            {elapsed}일 / 총 {currentGoal.plan.period.totalDays}일
          </span>
        </div>
      </section>

      <PlanCard plan={currentGoal.plan} goalTitle={currentGoal.title} />

      <section className="plan-view__days">
        <div className="plan-view__days-head">
          <h3 className="t-title">하루하루 일정</h3>
          <span className="t-caption">{currentGoal.plan.dailyAllocation.length}일</span>
        </div>
        <ol className="plan-view__list">
          {currentGoal.plan.dailyAllocation.map((d, i) => {
            const date = fromISO(d.date)
            const wd = WEEKDAYS[date.getDay()]
            const dayMissions = currentGoal.missions.filter(
              (m) => m.date === d.date,
            )
            const done = dayMissions.filter((m) => m.completed).length
            const isToday = d.date === today
            const isPast = d.date < today
            return (
              <li
                key={d.date}
                className={[
                  'plan-day-row',
                  isToday ? 'plan-day-row--today' : '',
                  isPast ? 'plan-day-row--past' : '',
                  `plan-day-row--phase-${d.phase}`,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="plan-day-row__date">
                  <span className="plan-day-row__wd">{wd}</span>
                  <span className="plan-day-row__d">{date.getDate()}</span>
                </div>
                <div className="plan-day-row__body">
                  <div className="plan-day-row__title">
                    {focusFor(i) ?? d.summary}
                  </div>
                  <div className="plan-day-row__sub t-caption">
                    {d.hours}h · {done}/{dayMissions.length} 완료
                  </div>
                </div>
                {isToday && <span className="plan-day-row__tag">오늘</span>}
              </li>
            )
          })}
        </ol>
      </section>

      <div className="plan-view__cta">
        <Button
          block
          variant="secondary"
          onClick={() => navigate('/home')}
        >
          홈으로
        </Button>
      </div>

      <Sheet
        open={renameOpen}
        title="목표 이름 바꾸기"
        onClose={() => setRenameOpen(false)}
        footer={
          <div className="mission-edit__footer">
            <Button
              block
              disabled={!draftTitle.trim()}
              onClick={() => {
                editGoalTitle(draftTitle.trim())
                setRenameOpen(false)
              }}
            >
              저장
            </Button>
          </div>
        }
      >
        <div className="mission-edit">
          <label className="mission-edit__group">
            <span className="t-caption">이름</span>
            <input
              className="profile-input"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              autoFocus
            />
          </label>
        </div>
      </Sheet>
    </div>
  )
}
