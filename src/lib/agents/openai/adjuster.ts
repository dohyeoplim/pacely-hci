/* Real Adjuster — LLM-driven notification text + plan re-shaping.

   Notification selection still uses the deterministic trigger picker so
   we control which kind of message fires (entry / milestone / etc).
   The text inside the message is what the LLM writes. */

import type {
  DailyAllocation,
  Goal,
  PacelyNotification,
  Persona,
  Plan,
  TriggerCategory,
} from '../../../types'
import { dDay, uid } from '../../util'
import type { AdjusterAgent, AdjusterContext, Insight } from '../types'
import { callLLM, parseJsonResponse, type ChatMessage } from './client'

function selectTrigger(ctx: AdjusterContext): TriggerCategory {
  const { goal, recentEvents } = ctx
  const { progress } = goal
  if (progress.missedStreak >= 3) return 'procrastination'
  if (progress.missedStreak >= 1) {
    return Math.random() < 0.5 ? 'emotion' : 'social'
  }
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
  if (openedButNotStarted) return 'lowburden'
  return 'entry'
}

const PERSONA_VOICE: Record<Persona, string> = {
  gentle:
    '동반자형 — 따뜻하고 부드러운 말투. "~요" 체. 1~2 문장, 80자 이내.',
  strict:
    '코치형 — 단호하고 명확한 말투. "~하세요" / "~합시다" 체. 1~2 문장, 80자 이내. 이모지 금지.',
}

const TRIGGER_FRAMING: Record<TriggerCategory, string> = {
  entry: '오늘 첫 미션 진입을 유도하는 메시지.',
  milestone: '마일스톤 / 절반 지점 도달 축하 메시지.',
  stats: '높은 완료율을 데이터 기반으로 격려.',
  dday: 'D-day가 다가오는 상황에 대한 페이스 조정 메시지.',
  procrastination: '3회 이상 미룬 패턴에 대한 부드러운 재계획 권유.',
  emotion: '실패감 / 자책 완화에 초점.',
  social: 'Pacely가 먼저 가 있다는 사회적 동조 메시지.',
  lowburden: '심리적 부담을 낮추는 "5분만" 류 메시지.',
}

function notiPrompt(
  ctx: AdjusterContext,
  trigger: TriggerCategory,
  persona: Persona,
): string {
  const g = ctx.goal
  return `목표: "${g.title}" (D${dDay(g.endDate) >= 0 ? '-' + dDay(g.endDate) : '+' + Math.abs(dDay(g.endDate))})
완주율: ${Math.round(g.progress.adherenceRate * 100)}%
연속 완료: ${g.progress.currentStreak}일 / 연속 미수행: ${g.progress.missedStreak}일

상황: ${TRIGGER_FRAMING[trigger]}
페르소나: ${PERSONA_VOICE[persona]}

위 상황에 맞는 알림 메시지 한 줄만 출력해. 따옴표나 설명 없이, 메시지만.`
}

interface RawPlanShape {
  dailyAllocation: {
    date: string
    hours: number
    summary: string
    phase: 0 | 1 | 2
  }[]
}

export class OpenAIAdjuster implements AdjusterAgent {
  async generateNotification(
    ctx: AdjusterContext,
  ): Promise<PacelyNotification | null> {
    const persona = ctx.goal.plan.persona
    const trigger = selectTrigger(ctx)

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          '너는 Pacely라는 한국어 AI 페이스메이커의 알림 메시지를 만든다. 한 번에 한 문장만, 80자 이내.',
      },
      { role: 'user', content: notiPrompt(ctx, trigger, persona) },
    ]

    let message: string
    try {
      message = (
        await callLLM(messages, { maxTokens: 120, temperature: 0.85 })
      )
        .trim()
        .replace(/^["']|["']$/g, '')
    } catch (err) {
      console.warn('[OpenAIAdjuster] LLM call failed', err)
      return null
    }

    return {
      id: uid('noti'),
      trigger,
      message,
      persona,
      createdAt: Date.now(),
      read: false,
    }
  }

  async replan(goal: Goal, insight: Insight): Promise<Plan> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `너는 Pacely 플래너의 재조정 단계. 사용자의 누적 패턴을 받아 기존 dailyAllocation을 다시 만들어내. 일별 hours / summary / phase만 조정하고, 날짜는 그대로 유지. JSON만 반환:
{"dailyAllocation":[{"date":"YYYY-MM-DD","hours":number,"summary":string,"phase":0|1|2}, ...]}`,
      },
      {
        role: 'user',
        content: `현재 플랜:
${goal.plan.dailyAllocation
  .map(
    (d) =>
      `- ${d.date} | ${d.hours}h | phase ${d.phase} | ${d.summary}`,
  )
  .join('\n')}

발견된 패턴: ${insight.summary}
권장 조치: ${insight.recommendation}

위 패턴을 반영해 dailyAllocation을 재조정해.`,
      },
    ]

    try {
      const raw = await callLLM(messages, {
        responseFormat: 'json',
        maxTokens: 2500,
        temperature: 0.5,
      })
      const parsed = parseJsonResponse<RawPlanShape>(raw)
      const allocByDate = new Map(
        parsed.dailyAllocation?.map((d) => [d.date, d]) ?? [],
      )
      const next: DailyAllocation[] = goal.plan.dailyAllocation.map((d) => {
        const updated = allocByDate.get(d.date)
        if (!updated) return d
        return {
          date: d.date,
          hours: clamp(updated.hours, 0.5, 14, d.hours),
          summary: updated.summary || d.summary,
          phase: ((updated.phase === 0 ||
            updated.phase === 1 ||
            updated.phase === 2)
            ? updated.phase
            : d.phase) as 0 | 1 | 2,
        }
      })
      return { ...goal.plan, dailyAllocation: next }
    } catch (err) {
      console.warn('[OpenAIAdjuster] replan failed', err)
      return goal.plan
    }
  }
}

function clamp(v: number, lo: number, hi: number, fallback: number): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return fallback
  return Math.max(lo, Math.min(hi, v))
}
