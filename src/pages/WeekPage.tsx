/* /week — Weekly mission view.

   Shows the next ~14 days of the plan as a vertical list. Each row is a day
   card with subjects, hours, and completion ratio. Tap a row to open that
   day's missions in the edit sheet (or add a new one). */

import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { MissionEditSheet } from '../components/MissionEditSheet'
import { MissionList } from '../components/MissionList'
import { usePacely } from '../lib/store/store'
import { fromISO, todayISO } from '../lib/util'
import type { MissionTask } from '../types'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const WINDOW_DAYS = 14

export function WeekPage() {
  const { currentGoal, addMission, editMission, deleteMission, toggleMission } =
    usePacely()
  const [activeDate, setActiveDate] = useState<string | null>(null)
  const [sheet, setSheet] = useState<
    { mode: 'add' | 'edit'; mission?: MissionTask } | null
  >(null)

  const today = todayISO()
  const days = useMemo(() => {
    if (!currentGoal) return []
    return currentGoal.plan.dailyAllocation
      .filter((d) => d.date >= today)
      .slice(0, WINDOW_DAYS)
  }, [currentGoal, today])

  if (!currentGoal) return <Navigate to="/welcome" replace />

  return (
    <div className="page week-page">
      <header className="record-head">
        <h1 className="t-title-lg">주간 일정</h1>
        <p className="t-caption">{currentGoal.title}</p>
      </header>

      <ul className="week-list">
        {days.map((d, i) => {
          const date = fromISO(d.date)
          const wd = WEEKDAYS[date.getDay()]
          const dayMissions = currentGoal.missions.filter((m) => m.date === d.date)
          const done = dayMissions.filter((m) => m.completed).length
          const ratio = dayMissions.length ? done / dayMissions.length : 0
          const isToday = d.date === today
          const isActive = activeDate === d.date
          const subjects = currentGoal.plan.subjects
          const focus =
            subjects.length > 0 ? subjects[i % subjects.length] : d.summary

          return (
            <li
              key={d.date}
              className={`week-row ${isActive ? 'week-row--open' : ''} ${isToday ? 'week-row--today' : ''}`}
            >
              <button
                className="week-row__head"
                onClick={() =>
                  setActiveDate(isActive ? null : d.date)
                }
              >
                <div className="week-row__date">
                  <span className="week-row__wd">{wd}</span>
                  <span className="week-row__d">{date.getDate()}</span>
                </div>
                <div className="week-row__body">
                  <div className="week-row__title">{focus}</div>
                  <div className="week-row__sub t-caption">
                    {d.hours}h · {done}/{dayMissions.length} 완료
                  </div>
                </div>
                {isToday && (
                  <span className="week-row__today-tag">오늘</span>
                )}
                <div className="week-row__ratio">
                  <span
                    className="week-row__ratio-fill"
                    style={{ width: `${ratio * 100}%` }}
                  />
                </div>
              </button>

              {isActive && (
                <div className="week-row__expand">
                  <MissionList
                    missions={dayMissions}
                    onToggle={(id) => {
                      if (d.date === today) void toggleMission(id)
                    }}
                    onEdit={(m) => setSheet({ mode: 'edit', mission: m })}
                  />
                  <button
                    className="add-task-btn"
                    onClick={() => setSheet({ mode: 'add' })}
                  >
                    <span aria-hidden>+</span>
                    <span>작업 추가</span>
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {days.length === 0 && (
        <div className="reward-empty">
          <div className="reward-empty__emoji" aria-hidden>
            🗓️
          </div>
          <div className="t-body-strong">남은 일정이 없어요</div>
          <p className="t-caption">목표를 완주했거나 기간이 지났어요.</p>
        </div>
      )}

      <MissionEditSheet
        open={!!sheet}
        mode={sheet?.mode ?? 'add'}
        goal={currentGoal}
        mission={sheet?.mission}
        defaultDate={activeDate ?? today}
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
