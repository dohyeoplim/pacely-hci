/* Real Planner — uses OpenAI gpt-4o-mini to produce a structured Plan
   plus matching per-day sub-tasks. Output is validated against the Plan
   shape before being returned to the UI; on any failure we surface a
   descriptive error so the caller can fall back to the mock. */

import type {
  DailyAllocation,
  GoalCategory,
  MissionTask,
  Milestone,
  Persona,
  Plan,
} from '../../../types'
import { addDays, daysBetween, uid } from '../../util'
import type { PlannerAgent, PlannerInput } from '../types'
import { callLLM, parseJsonResponse, type ChatMessage } from './client'

interface RawPlan {
  milestones: { title: string; cadence: string; week: number }[]
  dailyAllocation: {
    date: string
    hours: number
    summary: string
    phase: 0 | 1 | 2
  }[]
  missions: {
    date: string
    title: string
    estimatedMinutes: number
  }[]
}

const PERSONA_VOICE: Record<Persona, string> = {
  gentle:
    '동반자 톤. 따뜻하고 격려하는 말투. 사용자가 부담스럽지 않게 하루를 시작할 수 있도록.',
  strict:
    '코치 톤. 명확하고 단호한 말투. 시간 단위로 끊고 행동을 요구.',
}

function planSystemPrompt(): string {
  return `너는 Pacely라는 한국어 AI 페이스메이커야. 사용자의 목표를 분석해 단계별 마일스톤, 일별 시간 배분, 매일의 구체적인 하위 태스크를 만들어내는 게 너의 역할이야.

핵심 원칙:
1. 모든 출력은 한국어.
2. 일별 phase: 첫 40%는 phase 0 (워밍업/탐색), 중간 40%는 phase 1 (몰입), 마지막 20%는 phase 2 (마무리/회고).
3. 각 일자의 missions는 그 날의 hours에 비례한 estimatedMinutes 합으로 구성. 첫 미션은 항상 즉시 실행 가능한 25분 이하의 워밍업.
4. 미션 제목은 반드시 동사 + 구체 객체. "공부하기" X, "선형대수 1단원 예제 3문제 풀기" O.
5. 마일스톤은 3~5개. cadence는 "주 N일 · 하루 X시간" 같은 짧은 표현.
6. JSON만 반환. 설명 텍스트, 마크다운, 주석 금지.

스키마:
{
  "milestones": [{"title": string, "cadence": string, "week": number}, ...],
  "dailyAllocation": [{"date": "YYYY-MM-DD", "hours": number, "summary": string, "phase": 0 | 1 | 2}, ...],
  "missions": [{"date": "YYYY-MM-DD", "title": string, "estimatedMinutes": number}, ...]
}`
}

function planUserPrompt(input: PlannerInput): string {
  const totalDays = Math.max(daysBetween(input.startDate, input.endDate) + 1, 1)
  const allDates = Array.from({ length: totalDays }, (_, i) =>
    addDays(input.startDate, i),
  )
  return `다음 목표에 대한 플랜을 만들어줘.

목표: "${input.goalText}"
카테고리: ${input.category}
기간: ${input.startDate} ~ ${input.endDate} (총 ${totalDays}일)
하루 가용 시간: ${input.dailyHours}시간
페르소나: ${input.persona} — ${PERSONA_VOICE[input.persona]}
${input.subjects && input.subjects.length > 0 ? `다룰 주제 / 단계: ${input.subjects.join(', ')}` : ''}

다음 ${totalDays}개 날짜 모두 dailyAllocation에 포함해야 해:
${allDates.join(', ')}

각 날짜마다 3~5개의 구체적인 missions를 만들어. 미션의 estimatedMinutes 합은 그 날 hours * 60과 대략 일치해야 해 (±10분).

페르소나가 "${input.persona}"이라는 점을 미션 제목에도 반영해. ${
    input.persona === 'gentle'
      ? '부드럽게 권유하는 어휘 ("같이 정리해봐요" 류 제목 가능)'
      : '명확한 액션 동사 ("정리한다", "푼다", "검토한다") 위주'
  }.`
}

function missionRefinementSystem(): string {
  return `너는 Pacely 플래너의 미션 다듬기 단계야. 주어진 플랜의 dailyAllocation 각 날짜에 대해 3~5개의 구체적 하위 태스크를 만들어줘. 각 미션은:
- 동사 + 구체 객체 형식 ("자료 3개 찾아 노트 정리")
- estimatedMinutes 합 = 그 날 hours × 60 ± 10분
- 첫 미션은 25분 이하 즉시 실행 가능 워밍업

JSON만 반환:
{"missions":[{"date":"YYYY-MM-DD","title":string,"estimatedMinutes":number}, ...]}`
}

function summarizePlanForMissions(plan: Plan, category: GoalCategory): string {
  return `카테고리: ${category}
주제: ${plan.subjects.length > 0 ? plan.subjects.join(', ') : '(없음)'}
페르소나: ${plan.persona}
일별 정보:
${plan.dailyAllocation
  .map(
    (d) =>
      `- ${d.date} | ${d.hours}h | phase ${d.phase} | ${d.summary}`,
  )
  .join('\n')}`
}

export class OpenAIPlanner implements PlannerAgent {
  async decomposeGoal(input: PlannerInput): Promise<Plan> {
    const messages: ChatMessage[] = [
      { role: 'system', content: planSystemPrompt() },
      { role: 'user', content: planUserPrompt(input) },
    ]
    const raw = await callLLM(messages, {
      responseFormat: 'json',
      maxTokens: 3500,
      temperature: 0.6,
    })
    const parsed = parseJsonResponse<RawPlan>(raw)

    /* Map raw response → Plan, stamping ids and filling defaults. */
    const totalDays = Math.max(
      daysBetween(input.startDate, input.endDate) + 1,
      1,
    )
    const weeks = Math.max(Math.ceil(totalDays / 7), 1)

    const milestones: Milestone[] = (parsed.milestones ?? [])
      .slice(0, 5)
      .map((m) => ({
        id: uid('ms'),
        title: m.title,
        cadence: m.cadence,
        week: Math.max(1, Math.min(weeks, Math.round(m.week))),
        done: false,
      }))

    const dailyAllocation: DailyAllocation[] = (parsed.dailyAllocation ?? [])
      .filter((d) => d.date && d.date >= input.startDate && d.date <= input.endDate)
      .map((d) => ({
        date: d.date,
        hours: clampHours(d.hours, input.dailyHours),
        summary: d.summary,
        phase: clampPhase(d.phase),
      }))

    /* Stash raw missions on the plan via a non-public field so the
       optional generateMissions() method can read them without a second
       round-trip. We don't extend the Plan type here — instead we cache
       them on the planner instance keyed by plan id. */
    const planId = uid('plan')
    this.missionCache.set(planId, parsed.missions ?? [])

    return {
      id: planId,
      goalText: input.goalText,
      period: { startDate: input.startDate, endDate: input.endDate, totalDays },
      milestones,
      dailyAllocation,
      persona: input.persona,
      weeks,
      subjects: input.subjects ?? [],
    }
  }

  async generateMissions(
    plan: Plan,
    category: GoalCategory,
  ): Promise<MissionTask[]> {
    /* Fast path: reuse the missions returned alongside the plan. */
    const cached = this.missionCache.get(plan.id)
    if (cached && cached.length > 0) {
      this.missionCache.delete(plan.id)
      return cached.map((m) => ({
        id: uid('m'),
        title: m.title,
        date: m.date,
        estimatedMinutes: Math.max(15, Math.round(m.estimatedMinutes)),
        completed: false,
      }))
    }

    /* Otherwise refine the plan with a dedicated call (cheap retry path). */
    const raw = await callLLM(
      [
        { role: 'system', content: missionRefinementSystem() },
        { role: 'user', content: summarizePlanForMissions(plan, category) },
      ],
      { responseFormat: 'json', maxTokens: 2500, temperature: 0.6 },
    )
    const parsed = parseJsonResponse<{
      missions: { date: string; title: string; estimatedMinutes: number }[]
    }>(raw)
    return (parsed.missions ?? []).map((m) => ({
      id: uid('m'),
      title: m.title,
      date: m.date,
      estimatedMinutes: Math.max(15, Math.round(m.estimatedMinutes)),
      completed: false,
    }))
  }

  private missionCache = new Map<
    string,
    { date: string; title: string; estimatedMinutes: number }[]
  >()
}

function clampHours(value: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.max(0.5, Math.min(14, value))
}

function clampPhase(value: number): 0 | 1 | 2 {
  if (value === 0 || value === 1 || value === 2) return value
  return 0
}
