/* Battle helpers — used by the Compete tab. Opponent progress is simulated
   from elapsed time + persona, so the comparison feels alive without a server. */

import type { Battle, Goal } from '../../types'
import { uid } from '../util'

const OPPONENT_POOL = [
  { name: '주은', persona: 'fast' as const },
  { name: '도현', persona: 'steady' as const },
  { name: '서아', persona: 'casual' as const },
  { name: '민재', persona: 'fast' as const },
  { name: '하늘', persona: 'steady' as const },
]

/** Pacing rate per day, 0..1, by persona. */
const PERSONA_PACE: Record<Battle['opponent']['persona'], number> = {
  fast: 0.075,
  steady: 0.045,
  casual: 0.025,
}

export function createBattle(goalTitle: string, stake: string): Battle {
  const pick =
    OPPONENT_POOL[Math.floor(Math.random() * OPPONENT_POOL.length)]
  return {
    id: uid('bt'),
    goalTitle,
    stake,
    status: 'active',
    opponent: {
      name: pick.name,
      persona: pick.persona,
      progress: 0,
    },
    userProgress: 0,
    startedAt: Date.now(),
  }
}

/** Recompute opponent progress from elapsed time. */
export function tickBattle(b: Battle, now = Date.now()): Battle {
  if (b.status !== 'active') return b
  const elapsedDays = (now - b.startedAt) / 86_400_000
  const pace = PERSONA_PACE[b.opponent.persona]
  const progress = Math.min(1, elapsedDays * pace + 0.05)
  return { ...b, opponent: { ...b.opponent, progress } }
}

/** Resolve a battle against the user's current goal adherence. */
export function resolveBattle(b: Battle, goal: Goal | null): Battle {
  if (b.status !== 'active') return b
  const userProgress = goal ? goal.progress.adherenceRate : 0
  return {
    ...b,
    userProgress,
    status: userProgress >= b.opponent.progress ? 'won' : 'lost',
    resolvedAt: Date.now(),
  }
}

export const STAKE_PRESETS = [
  '커피 한 잔',
  '치킨 한 마리',
  '영화 한 편',
  '독서실 1주 이용권',
  '점심 한 끼',
]
