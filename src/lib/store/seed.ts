/* Demo seed — used by `?seed=demo` so screenshots and demos can land directly
   on the in-progress home / day-start without manually clicking through the
   planning flow. Idempotent: it bails out if a goal already exists. */

import type { Goal } from '../../types'
import { getAgents } from '../agents'
import { addDays, todayISO, uid } from '../util'
import { generateMissions } from './missions'
import { emptyProgress, recomputeProgress } from './progress'

export async function buildDemoGoal(): Promise<Goal> {
  const start = addDays(todayISO(), -5)
  const end = addDays(todayISO(), 15)
  const plan = await getAgents().planner.decomposeGoal({
    goalText: '1학기 중간고사 공부할거야. 이제 3주 남았어.',
    category: 'exam',
    startDate: start,
    endDate: end,
    dailyHours: 4,
    persona: 'gentle',
  })

  const missions = generateMissions(plan, 'exam')
  // Mark earlier days as completed so the progress rings have real values.
  const today = todayISO()
  const completedMissions = missions.map((m) => {
    if (m.date < today) {
      const flip = Math.random() > 0.25
      return flip ? { ...m, completed: true, completedAt: Date.now() } : m
    }
    return m
  })

  const goal: Goal = {
    id: uid('goal'),
    title: '1학기 중간고사 대비하기',
    category: 'exam',
    startDate: start,
    endDate: end,
    plan,
    missions: completedMissions,
    progress: emptyProgress(),
    status: 'active',
    createdAt: Date.now(),
  }
  return { ...goal, progress: recomputeProgress(goal) }
}
