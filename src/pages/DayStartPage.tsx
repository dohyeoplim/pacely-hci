import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { BackButton } from '../components/BackButton'
import { Button } from '../components/Button'
import { DDayBadge } from '../components/DDayBadge'
import { HoursCompareCard } from '../components/HoursCompareCard'
import { MissionEditSheet } from '../components/MissionEditSheet'
import { MissionList } from '../components/MissionList'
import { usePacely } from '../lib/store/store'
import { dDay, timeOfDay, todayISO } from '../lib/util'
import type { MissionTask } from '../types'

interface DayStartCopy {
  greeting: string
  headline: string
}
const COPY_BY_TIME: Record<ReturnType<typeof timeOfDay>, DayStartCopy> = {
  morning: {
    greeting: '좋은 아침이에요!',
    headline: '오늘의 목표를 확인해요',
  },
  afternoon: {
    greeting: '좋은 오후예요!',
    headline: '아직 늦지 않았어요',
  },
  evening: {
    greeting: '좋은 저녁이에요!',
    headline: '오늘 마지막 한 걸음',
  },
  night: {
    greeting: '늦은 시간이에요!',
    headline: '짧게라도 한 가지만',
  },
}

export function DayStartPage() {
  const navigate = useNavigate()
  const {
    currentGoal,
    recordEvent,
    addMission,
    editMission,
    deleteMission,
  } = usePacely()
  const [sheet, setSheet] = useState<
    { mode: 'add' | 'edit'; mission?: MissionTask } | null
  >(null)

  const today = todayISO()
  const todays = useMemo(
    () => currentGoal?.missions.filter((m) => m.date === today) ?? [],
    [currentGoal, today],
  )

  if (!currentGoal) return <Navigate to="/welcome" replace />

  const remaining = dDay(currentGoal.endDate)

  const onStartDay = async () => {
    await recordEvent({ type: 'day_started', goalId: currentGoal.id })
    navigate('/home')
  }

  const todaysPlanned =
    currentGoal.plan.dailyAllocation.find((d) => d.date === today)?.hours ?? 0
  const todaysUser =
    currentGoal.missions
      .filter((m) => m.date === today && m.completed)
      .reduce((s, m) => s + m.estimatedMinutes, 0) / 60

  return (
    <div className="page day-start-page">
      <header className="day-start__top">
        <BackButton />
      </header>

      <div className="day-start__intro">
        <h1 className="day-start__title">
          {COPY_BY_TIME[timeOfDay()].greeting}
          <br />
          {COPY_BY_TIME[timeOfDay()].headline}
        </h1>
        <div className="day-start__sub">
          {currentGoal.title} · <DDayBadge days={remaining} variant="inline" />
        </div>
      </div>

      <HoursCompareCard userHours={todaysUser} pacelyHours={todaysPlanned} />

      <section className="day-start__missions">
        <MissionList
          missions={todays}
          readOnly
          onEdit={(m) => setSheet({ mode: 'edit', mission: m })}
        />
        <button
          className="add-task-btn add-task-btn--inset"
          onClick={() => setSheet({ mode: 'add' })}
        >
          <span aria-hidden>+</span>
          <span>작업 추가</span>
        </button>
      </section>

      <div className="day-start__cta">
        <Button block onClick={onStartDay}>
          하루 시작하기
        </Button>
      </div>

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
