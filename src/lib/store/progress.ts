import type { Goal, MissionTask, Progress } from '../../types'
import { todayISO } from '../util'

export function recomputeProgress(goal: Goal): Progress {
  const today = todayISO()
  const completed = goal.missions.filter((m) => m.completed)
  const completedTaskIds = completed.map((m) => m.id)

  const totalHours =
    completed.reduce((sum, m) => sum + m.estimatedMinutes, 0) / 60

  const pacelyHours = goal.plan.dailyAllocation
    .filter((d) => d.date <= today)
    .reduce((sum, d) => sum + d.hours, 0)

  const dueMissions = goal.missions.filter((m) => m.date <= today)
  const adherenceRate =
    dueMissions.length === 0
      ? 0
      : dueMissions.filter((m) => m.completed).length / dueMissions.length

  const daysWithPacely = new Set(completed.map((m) => m.date)).size

  const { currentStreak, missedStreak, bestStreak } = computeStreaks(
    goal.missions,
    goal.plan.dailyAllocation.map((d) => d.date),
    today,
  )

  return {
    completedTaskIds,
    adherenceRate,
    pacelyVsUserHours: {
      user: Math.round(totalHours * 10) / 10,
      pacely: Math.round(pacelyHours * 10) / 10,
    },
    totalHours: Math.round(totalHours * 10) / 10,
    daysWithPacely,
    missedStreak,
    currentStreak,
    bestStreak,
  }
}

function computeStreaks(
  missions: MissionTask[],
  planDates: string[],
  today: string,
): { currentStreak: number; missedStreak: number; bestStreak: number } {
  const completedByDate = new Set(
    missions.filter((m) => m.completed).map((m) => m.date),
  )

  const dueDates = planDates.filter((d) => d <= today)

  let currentStreak = 0
  let missedStreak = 0
  let firstSeenIncomplete = false
  for (let i = dueDates.length - 1; i >= 0; i--) {
    const date = dueDates[i]
    if (completedByDate.has(date)) {
      currentStreak++
      firstSeenIncomplete = true
    } else {
      // Today incomplete doesn't break a streak built from prior days.
      if (date === today && !firstSeenIncomplete) {
        continue
      }
      break
    }
  }
  for (let i = dueDates.length - 1; i >= 0; i--) {
    const date = dueDates[i]
    if (date === today) continue
    if (completedByDate.has(date)) break
    missedStreak++
  }

  let best = 0
  let run = 0
  for (const date of planDates) {
    if (completedByDate.has(date)) {
      run++
      best = Math.max(best, run)
    } else if (date <= today) {
      run = 0
    }
  }

  return { currentStreak, missedStreak, bestStreak: best }
}

export function emptyProgress(): Progress {
  return {
    completedTaskIds: [],
    adherenceRate: 0,
    pacelyVsUserHours: { user: 0, pacely: 0 },
    totalHours: 0,
    daysWithPacely: 0,
    missedStreak: 0,
    currentStreak: 0,
    bestStreak: 0,
  }
}
