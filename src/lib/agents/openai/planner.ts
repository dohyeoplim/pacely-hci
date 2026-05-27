import type {
  DailyAllocation,
  GoalCategory,
  MissionTask,
  Milestone,
  Persona,
  Plan,
} from '../../../types'
import { daysBetween, uid } from '../../util'
import type {
  ParseGoalInput,
  ParseGoalResult,
  PlannerAgent,
  PlannerInput,
} from '../types'
import { callLLM, parseJsonResponse, type ChatMessage } from './client'

interface RawPlanStructure {
  milestones: { title: string; cadence: string; week: number }[]
  dailyAllocation: {
    date: string
    hours: number
    summary: string
    phase: 0 | 1 | 2
  }[]
}

interface RawMissions {
  missions: {
    date: string
    title: string
    estimatedMinutes: number
  }[]
}

function planSystemPrompt(): string {
  return `너는 Pacely 한국어 AI 페이스메이커. 목표를 받아 마일스톤 + 일별 시간 배분만 만들어. 미션은 다음 단계에서 따로 만드니까 여기선 제외.

규칙:
- 한국어. JSON만 반환.
- phase: 첫 40% phase 0, 중간 40% phase 1, 마지막 20% phase 2.
- 마일스톤은 3개 (간결 cadence).
- summary는 25자 이내, 동사 위주.

스키마:
{
  "milestones": [{"title": string, "cadence": string, "week": number}, ...],
  "dailyAllocation": [{"date": "YYYY-MM-DD", "hours": number, "summary": string, "phase": 0|1|2}, ...]
}`
}

function planUserPrompt(input: PlannerInput): string {
  const totalDays = Math.max(daysBetween(input.startDate, input.endDate) + 1, 1)
  return `목표: "${input.goalText}"
카테고리: ${input.category}
기간: ${input.startDate} ~ ${input.endDate} (총 ${totalDays}일)
하루 시간: ${input.dailyHours}h
페르소나: ${input.persona}
${input.subjects && input.subjects.length > 0 ? `주제/단계: ${input.subjects.join(', ')}` : ''}

${totalDays}일 모두 dailyAllocation에 포함. 마일스톤 3개.`
}

function missionRefinementSystem(persona: Persona): string {
  return `너는 Pacely 미션 생성기. 받은 일별 정보에 대해 매 날마다 3개의 구체 하위 태스크 생성.

규칙:
- 한국어. JSON만.
- 각 미션 제목: 동사 + 구체 객체 (예: "선형대수 예제 3문제 풀이"). 추상 X.
- 첫 미션은 25분 이하 즉시 실행 가능한 워밍업.
- 한 날 미션 estimatedMinutes 합 = hours×60 ± 10분.
- 페르소나 ${persona}: ${persona === 'gentle' ? '"같이 ~", "~해봐요" 어휘 가능' : '명령형 동사 "한다/푼다" 위주'}

스키마:
{"missions":[{"date":"YYYY-MM-DD","title":string,"estimatedMinutes":number}, ...]}`
}

function summarizePlanForMissions(plan: Plan, category: GoalCategory): string {
  return `카테고리: ${category}
주제: ${plan.subjects.length > 0 ? plan.subjects.join(', ') : '없음'}

일별:
${plan.dailyAllocation
  .map((d) => `${d.date}|${d.hours}h|p${d.phase}|${d.summary}`)
  .join('\n')}`
}

interface RawParseGoal {
  category?: string
  greeting: string
  suggestedSubjects?: string[]
  suggestedDays?: number
  followUp?: string
}

function parseGoalSystem(): string {
  return `너는 Pacely라는 한국어 AI 페이스메이커. 사용자가 자유롭게 적은 목표 문장을 받아서:
1. 카테고리 분류 — 다음 중 하나: "exam" (시험/공부/자격증/학점), "project" (개발/디자인/기획/포트폴리오), "workout" (운동/체력/다이어트), "diary" (일기/회고/기록), "custom" (위에 안 맞으면)
2. 따뜻하거나 단호한 한 줄 응답 (페르소나 반영, 60자 이내, 사용자의 목표를 짧게 인용하면 더 좋음)
3. 그 목표에 적합한 주제 / 단계 3~5개 (exam/project일 때만; 그 외는 빈 배열)
4. 추천 기간 (일 단위, 1~90 범위) — 사용자 문장에 기간 단서 있으면 우선 반영
5. 다음 단계로 권유하는 짧은 follow-up 한 줄 (선택)

스키마:
{
  "category": "exam" | "project" | "workout" | "diary" | "custom",
  "greeting": string,
  "suggestedSubjects": string[],
  "suggestedDays": number,
  "followUp": string | null
}

규칙:
- 페르소나 gentle = "~요" 체, 격려. strict = "~합시다" / "~하세요", 단호.
- JSON만 반환. 마크다운, 설명 금지.`
}

function parseGoalUserPrompt(input: ParseGoalInput): string {
  return `페르소나: ${input.persona}
${input.category ? `(힌트 — 사용자가 미리 고른 카테고리: ${input.category})` : ''}
사용자 목표 문장: "${input.goalText}"`
}

const VALID_CATEGORIES: ReadonlyArray<GoalCategory> = [
  'exam',
  'project',
  'workout',
  'diary',
  'custom',
]

function clampCategory(
  value: string | undefined,
  fallback: GoalCategory,
): GoalCategory {
  if (value && (VALID_CATEGORIES as readonly string[]).includes(value)) {
    return value as GoalCategory
  }
  return fallback
}

const FALLBACK_DAYS: Record<GoalCategory, number> = {
  exam: 14,
  project: 14,
  workout: 28,
  diary: 14,
  custom: 14,
}

export class OpenAIPlanner implements PlannerAgent {
  async parseGoal(input: ParseGoalInput): Promise<ParseGoalResult> {
    const messages: ChatMessage[] = [
      { role: 'system', content: parseGoalSystem() },
      { role: 'user', content: parseGoalUserPrompt(input) },
    ]
    try {
      const raw = await callLLM(messages, {
        responseFormat: 'json',
        maxTokens: 400,
        temperature: 0.7,
      })
      const parsed = parseJsonResponse<RawParseGoal>(raw)
      const category = clampCategory(parsed.category, input.category ?? 'custom')
      const supportsSubjects = category === 'exam' || category === 'project'
      return {
        category,
        greeting:
          (parsed.greeting ?? '').trim() ||
          '좋은 목표예요. 같이 잘 짜봐요.',
        suggestedSubjects: supportsSubjects
          ? (parsed.suggestedSubjects ?? []).slice(0, 6)
          : [],
        suggestedDays: clampInt(
          parsed.suggestedDays,
          1,
          90,
          FALLBACK_DAYS[category],
        ),
        followUp:
          parsed.followUp && parsed.followUp.trim().length > 0
            ? parsed.followUp.trim()
            : undefined,
      }
    } catch (err) {
      console.warn('[OpenAIPlanner] parseGoal failed, using fallback', err)
      const fallback: GoalCategory = input.category ?? 'custom'
      return {
        category: fallback,
        greeting:
          input.persona === 'gentle'
            ? '좋은 목표예요. 같이 잘 짜봐요.'
            : '좋습니다. 바로 계획에 들어갑시다.',
        suggestedSubjects: [],
        suggestedDays: FALLBACK_DAYS[fallback],
      }
    }
  }

  async decomposeGoal(input: PlannerInput): Promise<Plan> {
    const messages: ChatMessage[] = [
      { role: 'system', content: planSystemPrompt() },
      { role: 'user', content: planUserPrompt(input) },
    ]
    const raw = await callLLM(messages, {
      responseFormat: 'json',
      maxTokens: 1500,
      temperature: 0.6,
    })
    const parsed = parseJsonResponse<RawPlanStructure>(raw)

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
      .filter(
        (d) => d.date && d.date >= input.startDate && d.date <= input.endDate,
      )
      .map((d) => ({
        date: d.date,
        hours: clampHours(d.hours, input.dailyHours),
        summary: d.summary,
        phase: clampPhase(d.phase),
      }))

    return {
      id: uid('plan'),
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
    // Weekly batches in parallel to stay within the Edge 25s budget.
    const days = plan.dailyAllocation
    if (days.length <= 7) {
      return this.requestMissions(plan, days, category)
    }

    const weekChunks: typeof days[] = []
    for (let i = 0; i < days.length; i += 7) {
      weekChunks.push(days.slice(i, i + 7))
    }
    const batches = await Promise.all(
      weekChunks.map((chunk) =>
        this.requestMissions(
          { ...plan, dailyAllocation: chunk },
          chunk,
          category,
        ),
      ),
    )
    return batches.flat()
  }

  private async requestMissions(
    plan: Plan,
    chunk: { date: string; hours: number; summary: string; phase: 0 | 1 | 2 }[],
    category: GoalCategory,
  ): Promise<MissionTask[]> {
    const messages: ChatMessage[] = [
      { role: 'system', content: missionRefinementSystem(plan.persona) },
      {
        role: 'user',
        content: summarizePlanForMissions(
          { ...plan, dailyAllocation: chunk },
          category,
        ),
      },
    ]
    const raw = await callLLM(messages, {
      responseFormat: 'json',
      // ~3 missions per day × max 7 days × ~30 tokens = ~700 tokens
      maxTokens: 1200,
      temperature: 0.6,
    })
    const parsed = parseJsonResponse<RawMissions>(raw)
    return (parsed.missions ?? []).map((m) => ({
      id: uid('m'),
      title: m.title,
      date: m.date,
      estimatedMinutes: Math.max(15, Math.round(m.estimatedMinutes)),
      completed: false,
    }))
  }
}

function clampHours(value: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.max(0.5, Math.min(14, value))
}

function clampInt(
  value: number | undefined,
  lo: number,
  hi: number,
  fallback: number,
): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.max(lo, Math.min(hi, Math.round(value)))
}

function clampPhase(value: number): 0 | 1 | 2 {
  if (value === 0 || value === 1 || value === 2) return value
  return 0
}
