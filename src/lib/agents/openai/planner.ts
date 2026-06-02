import type {
  DailyAllocation,
  GoalCategory,
  MissionTask,
  Milestone,
  Persona,
  Plan,
} from '../../../types'
import { addDays, daysBetween, todayISO, uid } from '../../util'
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

function planSystemPrompt(category: GoalCategory): string {
  const milestoneBlock =
    category === 'exam'
      ? `- 마일스톤은 정확히 4개. 아래 4단계 흐름을 따르되, 각 마일스톤의 title·cadence에는 반드시 사용자가 준 실제 과목/주제를 직접 넣는다 (일반론 금지):
  1) "개념 학습 1회독" — 과목별 핵심 개념·이론 정리, 요약 노트 작성. cadence 예: "선형대수·확률통계 핵심 개념 정리".
  2) "유형별 문제 풀이" — 과목별 기출·연습문제로 적용력 기르기. cadence 예: "알고리즘·운영체제 기출 유형 풀이".
  3) "약점 보완 & 2회독" — 오답·약한 과목 집중 복습, 헷갈리는 개념 재정리.
  4) "실전 마무리 점검" — 모의 문제·총정리로 최종 점검.
  ※ 시험 범위 파악·우선순위 정하기는 첫날 하루 안에 끝낸다. "계획만 세우는 날"을 여러 날 두지 말 것 — 둘째 날부터는 곧바로 실제 학습.
  week 값은 전체 기간을 4구간으로 나눠 1→2→3→4 순서로 배치.`
      : `- 마일스톤은 3개 (간결 cadence).`

  return `너는 Pacely 한국어 AI 페이스메이커. 목표를 받아 마일스톤 + 일별 시간 배분만 만들어. 미션은 다음 단계에서 따로 만드니까 여기선 제외.

규칙:
- 한국어. JSON만 반환.
- phase: 첫 40% phase 0, 중간 40% phase 1, 마지막 20% phase 2.
${milestoneBlock}
- summary는 25자 이내, 동사 위주이며 가능한 한 그 날 다룰 실제 과목/주제를 담는다 (예: "선형대수 개념 정리").
- 첫날 외에는 "계획 세우기/범위 정리"만 하는 날을 만들지 말 것 — 매일 실제 학습 활동.

스키마:
{
  "milestones": [{"title": string, "cadence": string, "week": number}, ...],
  "dailyAllocation": [{"date": "YYYY-MM-DD", "hours": number, "summary": string, "phase": 0|1|2}, ...]
}`
}

function planUserPrompt(input: PlannerInput): string {
  const totalDays = Math.max(daysBetween(input.startDate, input.endDate) + 1, 1)
  const hasSubjects = !!input.subjects && input.subjects.length > 0
  const subjectLine = hasSubjects
    ? `과목/주제 (${input.subjects!.length}개 — 마일스톤 cadence와 일별 summary에 반드시 반영): ${input.subjects!.join(', ')}`
    : ''
  const milestoneTail =
    input.category === 'exam'
      ? `마일스톤 4개 (개념 학습 1회독 → 유형별 문제 풀이 → 약점 보완 & 2회독 → 실전 마무리 점검 순서 고정).${hasSubjects ? ' 각 단계 cadence에 위 과목명을 직접 넣을 것.' : ''}`
      : '마일스톤 3개.'
  return `목표: "${input.goalText}"
카테고리: ${input.category}
기간: ${input.startDate} ~ ${input.endDate} (총 ${totalDays}일)
하루 시간: ${input.dailyHours}h (모든 날 동일하게 학습)
페르소나: ${input.persona}
${subjectLine}

${totalDays}일 모두 dailyAllocation에 포함하고 각 날 hours=${input.dailyHours}. ${milestoneTail}`
}

function missionRefinementSystem(persona: Persona): string {
  return `너는 Pacely 미션 생성기. 받은 일별 정보로 매일 구체적인 하위 태스크를 생성한다.

규칙:
- 한국어. JSON만.
- 각 미션 제목은 "과목/주제 + 구체 활동 + 분량" 형태로 쓴다. 예: "선형대수 고유값 예제 5문제 풀이", "운영체제 3장 요약 노트 작성".
- "문제 풀기", "1번 문제 풀기", "공부하기"처럼 두루뭉술하거나 번호만 있는 제목 금지. 항상 어떤 과목의 무엇을 하는지 드러낸다.
- 주제가 여러 개면 날마다·미션마다 과목을 골고루 순환시킨다 (한 과목에 쏠리지 않게).
- 그 날 summary와 phase에 맞게 활동 성격을 정한다 (p0 개념 정리, p1 문제 풀이, p2 복습·점검).
- 첫 미션은 25분 이하로 바로 시작 가능한 워밍업.
- 한 날 미션 estimatedMinutes 합 = hours×60 ± 10분. hours가 크면 미션 개수를 늘려서 시간을 꽉 채운다 (3개로 끝내지 말 것).
- 페르소나 ${persona}: ${persona === 'gentle' ? '"같이 ~", "~해봐요" 어휘 가능' : '명령형 동사 "한다/푼다" 위주'}

스키마:
{"missions":[{"date":"YYYY-MM-DD","title":string,"estimatedMinutes":number}, ...]}`
}

function summarizePlanForMissions(plan: Plan, category: GoalCategory): string {
  return `카테고리: ${category}
과목/주제 (미션 제목에 반드시 반영, 골고루 순환): ${plan.subjects.length > 0 ? plan.subjects.join(', ') : '없음'}

일별 (date|hours|phase|summary):
${plan.dailyAllocation
  .map((d) => `${d.date}|${d.hours}h|p${d.phase}|${d.summary}`)
  .join('\n')}`
}

interface RawParseGoal {
  category?: string
  shortTitle?: string
  greeting: string
  suggestedSubjects?: string[]
  suggestedDays?: number
  suggestedStartDate?: string | null
  suggestedEndDate?: string | null
}

function parseGoalSystem(): string {
  return `너는 Pacely 한국어 AI 페이스메이커. 사용자의 자유 문장을 받아 다음을 추출해:

1. category — "exam" | "project" | "workout" | "diary" | "custom"
2. shortTitle — 페이지 제목으로 쓸 짧은 한 줄 (16자 이내, 명사구, 동사/문장부호 최소화)
3. greeting — 따뜻하거나 단호한 한 줄 응답 (페르소나 반영, 60자 이내)
4. suggestedSubjects — 주제 / 단계 3~5개 (exam/project만, 그 외는 빈 배열)
5. suggestedDays — 추천 기간(일). 사용자가 기간을 적었으면 정확히 환산: "2주"=14, "3주"=21, "한 달"=30, "열흘"=10, "10일"=10. 단서가 없을 때만 적당히 추천 (1~90).
6. suggestedStartDate / suggestedEndDate — 사용자가 "6월 10일", "다음 주 월요일"처럼 실제 달력 날짜/시점을 콕 집었을 때만 YYYY-MM-DD로 둘 다 채운다. "2주", "열흘" 같은 기간 표현만 있으면 둘 다 null (기간은 suggestedDays로만 표현하고 날짜는 만들지 않는다).

스키마:
{
  "category": "exam" | "project" | "workout" | "diary" | "custom",
  "shortTitle": string,
  "greeting": string,
  "suggestedSubjects": string[],
  "suggestedDays": number,
  "suggestedStartDate": string | null,
  "suggestedEndDate": string | null
}

규칙:
- shortTitle은 사용자가 길게 적어도 핵심만. "운영체제 시험 준비를 위해 일주일 동안 매일 4시간씩 자료를 정리하고…" → "운영체제 시험 준비".
- 페르소나 gentle = "~요" 체. strict = "~합시다" / "~하세요" 체.
- JSON만 반환. 마크다운, 설명 금지.`
}

function parseGoalUserPrompt(input: ParseGoalInput): string {
  return `오늘 날짜: ${todayISO()}
페르소나: ${input.persona}
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

const DEFAULT_PHASE_SUMMARY: Record<0 | 1 | 2, string> = {
  0: '핵심 개념 정리',
  1: '문제 풀이 & 적용',
  2: '복습 & 마무리 점검',
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
      const suggestedDays = clampInt(
        parsed.suggestedDays,
        1,
        90,
        FALLBACK_DAYS[category],
      )
      const { suggestedStartDate, suggestedEndDate } = sanitizeDateHint(
        parsed.suggestedStartDate,
        parsed.suggestedEndDate,
        suggestedDays,
      )
      const rawTitle = (parsed.shortTitle ?? '').trim()
      const shortTitle =
        rawTitle.length > 0 && rawTitle.length <= 24
          ? rawTitle
          : fallbackTitleFor(input.goalText, category)
      return {
        category,
        shortTitle,
        greeting:
          (parsed.greeting ?? '').trim() ||
          '좋은 목표예요. 같이 잘 짜봐요.',
        suggestedSubjects: supportsSubjects
          ? (parsed.suggestedSubjects ?? []).slice(0, 6)
          : [],
        suggestedDays,
        suggestedStartDate,
        suggestedEndDate,
      }
    } catch (err) {
      console.warn('[OpenAIPlanner] parseGoal failed, using fallback', err)
      const fallback: GoalCategory = input.category ?? 'custom'
      return {
        category: fallback,
        shortTitle: fallbackTitleFor(input.goalText, fallback),
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
      { role: 'system', content: planSystemPrompt(input.category) },
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

    /* Build the day scaffold deterministically rather than trusting the
       LLM's dailyAllocation wholesale. This guarantees: (1) every day in the
       chosen period is covered, (2) each day honors the user's selected daily
       hours instead of the model silently under-allocating, and (3) phases are
       evenly distributed (first 40% → 0, next 40% → 1, last 20% → 2). The LLM
       only contributes the per-day summary text, matched back by date. */
    const summaryByDate = new Map<string, string>()
    for (const d of parsed.dailyAllocation ?? []) {
      if (d?.date && typeof d.summary === 'string' && d.summary.trim()) {
        summaryByDate.set(d.date, d.summary.trim())
      }
    }
    const dailyAllocation: DailyAllocation[] = Array.from(
      { length: totalDays },
      (_, i) => {
        const date = addDays(input.startDate, i)
        const ratio = totalDays > 1 ? i / totalDays : 0
        const phase: 0 | 1 | 2 = ratio < 0.4 ? 0 : ratio < 0.8 ? 1 : 2
        return {
          date,
          hours: input.dailyHours,
          summary: summaryByDate.get(date) ?? DEFAULT_PHASE_SUMMARY[phase],
          phase,
        }
      },
    )

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

function clampInt(
  value: number | undefined,
  lo: number,
  hi: number,
  fallback: number,
): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.max(lo, Math.min(hi, Math.round(value)))
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

/* Validate the LLM-suggested date pair. Returns both or neither — we never
   carry a half-valid range forward. */
function sanitizeDateHint(
  start: string | null | undefined,
  end: string | null | undefined,
  fallbackDays: number,
): { suggestedStartDate?: string; suggestedEndDate?: string } {
  const today = todayISO()
  const validStart = typeof start === 'string' && ISO_RE.test(start)
  const validEnd = typeof end === 'string' && ISO_RE.test(end)
  if (!validStart || !validEnd) return {}
  const s = start as string
  const e = end as string
  if (s < today) return {}
  if (e < s) return {}
  const dayDelta = daysBetween(s, e) + 1
  if (dayDelta < 1 || dayDelta > 120) return {}
  void fallbackDays
  void addDays
  return { suggestedStartDate: s, suggestedEndDate: e }
}

function fallbackTitleFor(text: string, category: GoalCategory): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  const defaults: Record<GoalCategory, string> = {
    exam: '시험 대비',
    project: '프로젝트',
    workout: '운동 루틴',
    diary: '일기 습관',
    custom: '나만의 목표',
  }
  if (!trimmed) return defaults[category]
  const cut = trimmed.split(/[,.!?\n]|할거야|하고\s*싶|준비/)[0].trim()
  const base = cut.length > 0 ? cut : trimmed
  return base.length > 16 ? base.slice(0, 16) + '…' : base
}
