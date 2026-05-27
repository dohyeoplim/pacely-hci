import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { DDayBadge } from '../components/DDayBadge'
import { MissionEditSheet } from '../components/MissionEditSheet'
import { MissionList } from '../components/MissionList'
import { NotificationToast } from '../components/NotificationToast'
import { PwaPrompts } from '../components/PwaPrompts'
import { ProgressRing } from '../components/ProgressRing'
import { usePacelyMessage } from '../lib/pacelyMessage'
import { usePacely } from '../lib/store/store'
import { dDay, formatHours, fromISO, timeOfDay, todayISO } from '../lib/util'
import type { MissionTask } from '../types'
import pacelySymbol from '../assets/pacely-symbol.svg'

const GREETING_BY_TIME: Record<ReturnType<typeof timeOfDay>, string> = {
  morning: '좋은 아침이에요',
  afternoon: '좋은 오후예요',
  evening: '좋은 저녁이에요',
  night: '늦은 시간이에요',
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function formatHeadDate(iso: string): string {
  const d = fromISO(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 · ${WEEKDAYS[d.getDay()]}요일`
}

interface PaceCompare {
  userPct: number
  pacelyPct: number
  status: 'ahead' | 'aligned' | 'behind'
}

function comparePace(goal: ReturnType<typeof usePacely>['currentGoal']): PaceCompare {
  if (!goal) return { userPct: 0, pacelyPct: 0, status: 'aligned' }
  const totalPlanned = goal.plan.dailyAllocation.reduce((s, d) => s + d.hours, 0)
  const userPct = totalPlanned ? goal.progress.totalHours / totalPlanned : 0

  const today = todayISO()
  const elapsed = goal.plan.dailyAllocation.filter((d) => d.date <= today).length
  const pacelyPct = goal.plan.period.totalDays
    ? elapsed / goal.plan.period.totalDays
    : 0

  const diff = userPct - pacelyPct
  const status: PaceCompare['status'] =
    diff < -0.05 ? 'behind' : diff > 0.05 ? 'ahead' : 'aligned'
  return { userPct, pacelyPct, status }
}

const STATUS_COPY: Record<PaceCompare['status'], { text: string; emoji: string }> = {
  ahead: { text: '페이스를 앞서고 있어요', emoji: '🔥' },
  aligned: { text: '같은 페이스로 가고 있어요', emoji: '✨' },
  behind: { text: '살짝 뒤처지고 있어요', emoji: '🚀' },
}

export function HomePage() {
  const navigate = useNavigate()
  const { currentGoal, state, toggleMission, addMission, editMission, deleteMission } =
    usePacely()
  const [sheet, setSheet] = useState<
    { mode: 'add' | 'edit'; mission?: MissionTask } | null
  >(null)

  const today = todayISO()
  const todays = useMemo(
    () => currentGoal?.missions.filter((m) => m.date === today) ?? [],
    [currentGoal, today],
  )
  const pace = useMemo(() => comparePace(currentGoal), [currentGoal])
  const coachMessage = usePacelyMessage(
    currentGoal ?? ({} as never),
    state.user.personaPreference,
  )

  if (!currentGoal) return <Navigate to="/welcome" replace />
  if (currentGoal.status === 'finished') return <Navigate to="/finish" replace />

  const remaining = dDay(currentGoal.endDate)
  const tod = timeOfDay()
  const greeting = state.user.name
    ? `${state.user.name}님, ${GREETING_BY_TIME[tod]}`
    : GREETING_BY_TIME[tod]
  const initial = state.user.name?.[0]
  const doneCount = todays.filter((m) => m.completed).length
  const allDone = todays.length > 0 && doneCount === todays.length
  const todaysPlanned =
    currentGoal.plan.dailyAllocation.find((d) => d.date === today)?.hours ?? 0
  const todaysCompletedHours =
    todays.filter((m) => m.completed).reduce((s, m) => s + m.estimatedMinutes, 0) /
    60

  return (
    <div className="page home-page">
      <NotificationToast />
      <header className="home-head">
        <div>
          <div className="home-head__date">{formatHeadDate(today)}</div>
          <h1 className="home-head__greet">{greeting}</h1>
          <div className="home-head__coach">{coachMessage}</div>
        </div>
        <div className="home-head__avatar" aria-hidden>
          {initial ?? (
            <img
              src={pacelySymbol}
              alt=""
              className="home-head__avatar-mark"
            />
          )}
        </div>
      </header>

      <button
        className="home-hero"
        onClick={() => navigate('/plan')}
        aria-label="전체 플랜 보기"
      >
        <div className="home-hero__row">
          <span className="t-caption">수행 중인 목표</span>
          <DDayBadge days={remaining} />
        </div>
        <div className="home-hero__title">{currentGoal.title}</div>
        <div className="home-hero__meta">
          <span className="home-hero__stat">
            <span aria-hidden>🔥</span>
            {currentGoal.progress.currentStreak > 0
              ? `${currentGoal.progress.currentStreak}일 연속`
              : '오늘부터 시작'}
          </span>
          <span className="home-hero__divider" aria-hidden />
          <span className="home-hero__stat">
            <span aria-hidden>⏱️</span>
            {formatHours(currentGoal.progress.totalHours)} 누적
          </span>
        </div>
      </button>

      <section className="home-rings">
        <ProgressRing
          value={pace.userPct}
          label="You"
          color="var(--you)"
          size={144}
        />
        <ProgressRing
          value={pace.pacelyPct}
          label="Pacely"
          color="var(--pacely)"
          size={144}
        />
      </section>

      <section className="home-todo">
        <div className="home-todo__head">
          <div>
            <h2 className="t-title">오늘 할 일</h2>
            <div className="t-micro">
              {todaysCompletedHours.toFixed(1)}h / {todaysPlanned}h 계획
            </div>
          </div>
          <span className="home-todo__count">
            {doneCount} / {todays.length}
          </span>
        </div>
        <MissionList
          missions={todays}
          onToggle={toggleMission}
          onEdit={(m) => setSheet({ mode: 'edit', mission: m })}
        />
        <button
          className="add-task-btn"
          onClick={() => setSheet({ mode: 'add' })}
        >
          <span aria-hidden>+</span>
          <span>작업 추가</span>
        </button>
      </section>

      {allDone ? (
        <section className="home-status home-status--done">
          <div className="home-status__emoji" aria-hidden>
            🎉
          </div>
          <div className="home-status__body">
            <div className="t-body-strong">오늘 다 했어요!</div>
            <Link
              to={state.experiment.rewardEnabled ? '/reward' : '/record'}
              className="home-status__link"
            >
              {state.experiment.rewardEnabled ? '내 자취 보기 →' : '기록 보기 →'}
            </Link>
          </div>
        </section>
      ) : (
        <section className="home-status">
          <div className="home-status__emoji" aria-hidden>
            {STATUS_COPY[pace.status].emoji}
          </div>
          <div className="home-status__body">
            <div className="t-body-strong">{STATUS_COPY[pace.status].text}</div>
            <Link to="/record" className="home-status__link">
              오늘 한 일 기록하기 →
            </Link>
          </div>
        </section>
      )}

      <PwaPrompts />

      <MissionEditSheet
        open={!!sheet}
        mode={sheet?.mode ?? 'add'}
        plan={currentGoal.plan}
        mission={sheet?.mission}
        defaultDate={today}
        onSave={(input) => {
          if (input.id) {
            editMission(input.id, {
              title: input.title,
              estimatedMinutes: input.estimatedMinutes,
              date: input.date,
            })
          } else {
            addMission({
              title: input.title,
              estimatedMinutes: input.estimatedMinutes,
              date: input.date,
            })
          }
        }}
        onDelete={deleteMission}
        onClose={() => setSheet(null)}
      />
    </div>
  )
}
