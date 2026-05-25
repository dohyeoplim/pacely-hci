/* Mock Adjuster — context-aware notifications + plan re-shaping (spec §F2.2).

   Notifications branch on situation/progress/emotion, not just time. Message
   tone is persona-conditioned. The real Adjuster would feed the same context
   into the ReasoningEngine. */

import type {
  Goal,
  PacelyNotification,
  Persona,
  Plan,
  TriggerCategory,
} from '../../../types'
import { dDay, uid } from '../../util'
import { delay } from '../reasoning'
import type { AdjusterAgent, AdjusterContext, Insight } from '../types'

/** Message pools per trigger × persona, lifted from the spec's F2.2 table. */
const MESSAGES: Record<TriggerCategory, Record<Persona, string[]>> = {
  entry: {
    gentle: [
      '오늘 첫 미션은 가볍게 시작해볼까요?',
      '10분만 책상 앞에 앉아보아요!',
      '지금 바로 시작이 어렵다면, 딱 하나만 열어볼까요?',
    ],
    strict: [
      '오늘 첫 미션, 지금 시작합니다.',
      '미루지 말고 책상 앞으로. 10분이면 됩니다.',
      '시작이 반입니다. 첫 항목부터 바로 가죠.',
    ],
  },
  milestone: {
    gentle: [
      '딱 중간 지점이에요! 벌써 절반을 왔어요.',
      '마일스톤 하나 달성! 이 페이스 정말 좋아요.',
    ],
    strict: [
      '마일스톤 달성. 페이스 유지하면 완주는 확실합니다.',
      '절반 통과. 여기서 느슨해지지 않습니다.',
    ],
  },
  stats: {
    gentle: [
      '이번 달 완주율 91%예요! 일주일 전의 나, 지금 놀랄걸요?',
      '꾸준함이 쌓이고 있어요. 데이터가 증명하고 있어요.',
    ],
    strict: [
      '이번 달 완주율 91%. 수치가 말해줍니다 — 잘하고 있습니다.',
      '기록이 증거입니다. 이 흐름을 끊지 마세요.',
    ],
  },
  dday: {
    gentle: [
      'D-day가 다가와요. 차근차근 잘 가고 있어요.',
      '얼마 안 남았어요. 지금처럼만 하면 충분해요.',
    ],
    strict: [
      'D-day 임박. 남은 기간 집중해서 마무리합니다.',
      '시간이 줄고 있습니다. 우선순위대로 처리하세요.',
    ],
  },
  procrastination: {
    gentle: [
      '세 번째 미루셨네요. 함께 계획을 조정해 볼까요?',
      '며칠 멈췄지만 괜찮아요. 계획을 다시 맞춰봐요.',
    ],
    strict: [
      '세 번 연속 미뤘습니다. 계획을 지금 조정합니다.',
      '패턴이 보입니다. 계획 재조정이 필요합니다.',
    ],
  },
  emotion: {
    gentle: [
      '자책하지 마세요. 못 했다고 실패는 아니잖아요.',
      '오늘은 가장 쉬운 것부터 열어볼까요?',
    ],
    strict: [
      '지난 건 지난 겁니다. 오늘 한 걸음이면 됩니다.',
      '감정보다 행동. 가장 작은 것부터 시작하세요.',
    ],
  },
  social: {
    gentle: [
      '앞에서 기다리니 심심해요. 얼른 따라와요!',
      '앉아서 기다리고 있어요. 언제 시작하시나요?',
    ],
    strict: [
      '저는 이미 출발했습니다. 따라오세요.',
      '기다리고 있습니다. 페이스 맞춰주시죠.',
    ],
  },
  lowburden: {
    gentle: ['딱 5분만 해볼까요?', '커피 한 잔 하고 시작해요.'],
    strict: ['5분만. 그 이상은 요구하지 않습니다.', '딱 한 문제. 그걸로 시작합니다.'],
  },
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Decide which trigger fires given the current goal state + recent events. */
function selectTrigger(ctx: AdjusterContext): TriggerCategory {
  const { goal, recentEvents } = ctx
  const { progress } = goal

  if (progress.missedStreak >= 3) return 'procrastination'
  if (progress.missedStreak >= 1) return pick(['emotion', 'social'] as const)

  const justReachedMilestone = recentEvents.some(
    (e) => e.type === 'mission_completed' && e.payload?.milestoneReached,
  )
  if (justReachedMilestone) return 'milestone'

  const remaining = dDay(goal.endDate)
  if (remaining >= 0 && remaining <= 7) return 'dday'

  if (progress.adherenceRate >= 0.85) return 'stats'

  const openedButNotStarted =
    recentEvents.some((e) => e.type === 'app_open') &&
    !recentEvents.some((e) => e.type === 'day_started')
  if (openedButNotStarted) return pick(['entry', 'lowburden', 'social'] as const)

  return 'entry'
}

export class MockAdjuster implements AdjusterAgent {
  async generateNotification(
    ctx: AdjusterContext,
  ): Promise<PacelyNotification | null> {
    await delay(220 + Math.random() * 300)
    const persona = ctx.goal.plan.persona
    const trigger = selectTrigger(ctx)
    return {
      id: uid('noti'),
      trigger,
      message: pick(MESSAGES[trigger][persona]),
      persona,
      createdAt: Date.now(),
      read: false,
    }
  }

  async replan(goal: Goal, insight: Insight): Promise<Plan> {
    await delay(360 + Math.random() * 360)
    // Mock re-shaping: when the Analyzer flags afternoon slumps, re-tag the
    // remaining days as morning-focused. Structure stays; summaries shift.
    if (insight.kind !== 'afternoon_focus_drop') return goal.plan
    return {
      ...goal.plan,
      dailyAllocation: goal.plan.dailyAllocation.map((d) => ({
        ...d,
        summary: d.summary.includes('오전')
          ? d.summary
          : `오전 집중 · ${d.summary}`,
      })),
    }
  }
}
