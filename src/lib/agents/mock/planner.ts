/* Mock Planner — decomposes a goal into milestones + daily allocation.

   Deterministic, offline. The real Planner would build a decomposition prompt
   from PlannerInput, call the ReasoningEngine, and parse a structured Plan. */

import type {
  DailyAllocation,
  GoalCategory,
  Milestone,
  Persona,
  Plan,
} from '../../../types'
import { addDays, daysBetween, formatHours, uid } from '../../util'
import { delay } from '../reasoning'
import type {
  ParseGoalInput,
  ParseGoalResult,
  PlannerAgent,
  PlannerInput,
} from '../types'

interface CategoryTemplate {
  /** three phases: ramp-up → core → wrap-up */
  phases: { title: string; cadence: (h: number) => string }[]
  daySummary: (phase: number, h: number) => string
}

const TEMPLATES: Record<GoalCategory, CategoryTemplate> = {
  exam: {
    phases: [
      { title: '전 범위 1회독', cadence: (h) => `주 5일 · 하루 ${formatHours(h)}` },
      { title: '약점 보완 + 문제풀이', cadence: (h) => `주 6일 · 하루 ${formatHours(h)}` },
      { title: '마무리 정리', cadence: () => '매일 · 과목별 순환' },
    ],
    daySummary: (p, h) =>
      ['개념 정리 위주', '문제풀이 + 오답', '약점 과목 순환'][p] +
      ` · ${formatHours(h)}`,
  },
  project: {
    phases: [
      { title: '리서치 & 기획', cadence: (h) => `주 4일 · 하루 ${formatHours(h)}` },
      { title: '핵심 기능 구현', cadence: (h) => `주 5일 · 하루 ${formatHours(h)}` },
      { title: '다듬기 & 마무리', cadence: (h) => `매일 · 하루 ${formatHours(h)}` },
    ],
    daySummary: (p, h) =>
      ['자료 조사 & 설계', '구현 스프린트', 'QA & 마감 준비'][p] +
      ` · ${formatHours(h)}`,
  },
  workout: {
    phases: [
      { title: '기초 체력 만들기', cadence: () => '주 3일 · 가볍게' },
      { title: '강도 끌어올리기', cadence: () => '주 4일 · 인터벌' },
      { title: '루틴 정착', cadence: () => '주 5일 · 꾸준히' },
    ],
    daySummary: (p) =>
      ['워밍업 + 유산소', '근력 + 인터벌', '루틴 유지 세션'][p],
  },
  diary: {
    phases: [
      { title: '쓰는 습관 만들기', cadence: () => '매일 · 5분' },
      { title: '꾸준히 이어가기', cadence: () => '매일 · 10분' },
      { title: '돌아보기', cadence: () => '매일 · 회고' },
    ],
    daySummary: (p) =>
      ['오늘 한 줄 쓰기', '하루 기록 + 감정', '한 주 돌아보기'][p],
  },
  custom: {
    phases: [
      { title: '시작하기', cadence: (h) => `하루 ${formatHours(h)}` },
      { title: '몰입하기', cadence: (h) => `하루 ${formatHours(h)}` },
      { title: '완성하기', cadence: (h) => `하루 ${formatHours(h)}` },
    ],
    daySummary: (p, h) =>
      ['가볍게 시작', '본격 몰입', '마무리 점검'][p] + ` · ${formatHours(h)}`,
  },
}

/** Which phase (0,1,2) a given elapsed-day index falls into. */
function phaseOf(dayIndex: number, totalDays: number): number {
  const ratio = dayIndex / Math.max(totalDays, 1)
  if (ratio < 0.4) return 0
  if (ratio < 0.8) return 1
  return 2
}

const DEFAULT_SUBJECTS: Record<GoalCategory, string[]> = {
  exam: ['핵심 개념', '문제 풀이', '오답 정리'],
  project: ['리서치', '디자인', '구현', 'QA'],
  workout: [],
  diary: [],
  custom: [],
}

const DEFAULT_DAYS: Record<GoalCategory, number> = {
  exam: 14,
  project: 14,
  workout: 28,
  diary: 14,
  custom: 14,
}

const GREETING_BY_PERSONA: Record<Persona, Record<GoalCategory, string[]>> = {
  gentle: {
    exam: [
      '시험 준비, 같이 차근차근 가요. 무리하지 않게 짜볼게요.',
      '좋은 목표예요. 부담 안 되게 매일 조금씩 나눠봐요.',
    ],
    project: [
      '프로젝트 시작이 가장 어렵죠. 작은 단계로 같이 쪼개봐요.',
      '함께 가요. 큰 그림부터 한 발씩 같이 잡아볼게요.',
    ],
    workout: [
      '운동은 매일의 작은 약속이에요. 같이 시작해봐요.',
      '몸이 익숙해질 때까지 옆에 있을게요.',
    ],
    diary: [
      '한 줄이면 충분해요. 매일 같이 적어봐요.',
      '기록은 천천히 쌓이는 자취예요. 가볍게 시작해요.',
    ],
    custom: [
      '좋은 출발이에요. 같이 작은 단계로 만들어볼게요.',
      '같이 가는 길이라 든든할 거예요.',
    ],
  },
  strict: {
    exam: [
      '시험 일정에 맞춰 데이터 기준으로 짭니다. 계획 따라오세요.',
      '시간 단위로 끊어서 갑니다. 흔들리지 마세요.',
    ],
    project: [
      '프로젝트는 단계와 마감이 전부입니다. 바로 정리합니다.',
      '의존 관계 잡고 우선순위대로 갑니다.',
    ],
    workout: [
      '운동은 빈도가 핵심입니다. 주당 횟수부터 정합니다.',
      '루틴 정착이 목표입니다. 빠지지 마세요.',
    ],
    diary: [
      '매일 같은 시각에 기록합니다. 시간만 정하세요.',
      '습관화는 시간 고정이 우선입니다.',
    ],
    custom: [
      '목표를 명확히 잡았으니 단계로 분해합니다.',
      '계획부터 잡고 시작합니다.',
    ],
  },
}

const FOLLOW_UP_BY_CATEGORY: Partial<Record<GoalCategory, string>> = {
  exam: '어떤 과목들을 다룰지 같이 정해봐요.',
  project: '어떤 단계로 진행할지 정리해봐요.',
}

function pickFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Tiny keyword classifier used when the caller hasn't pre-selected a
   category. Covers the obvious Korean goal-statement patterns. */
function inferCategory(text: string): GoalCategory {
  const t = text.toLowerCase()
  if (/(시험|기말|중간|자격증|토익|토플|학점|공부)/.test(t)) return 'exam'
  if (/(프로젝트|개발|디자인|기획|구현|런칭|발표|포트폴리오)/.test(t)) return 'project'
  if (/(운동|헬스|러닝|요가|필라테스|체력|다이어트)/.test(t)) return 'workout'
  if (/(일기|기록|회고|저널|감정)/.test(t)) return 'diary'
  return 'custom'
}

export class MockPlanner implements PlannerAgent {
  async parseGoal(input: ParseGoalInput): Promise<ParseGoalResult> {
    await delay(280 + Math.random() * 320)
    const category = input.category ?? inferCategory(input.goalText)
    const greeting = pickFrom(GREETING_BY_PERSONA[input.persona][category])
    return {
      category,
      greeting,
      suggestedSubjects: DEFAULT_SUBJECTS[category],
      suggestedDays: DEFAULT_DAYS[category],
      followUp: FOLLOW_UP_BY_CATEGORY[category],
    }
  }

  async decomposeGoal(input: PlannerInput): Promise<Plan> {
    await delay(420 + Math.random() * 480)

    const totalDays = Math.max(
      daysBetween(input.startDate, input.endDate) + 1,
      1,
    )
    const weeks = Math.max(Math.ceil(totalDays / 7), 1)
    const tpl = TEMPLATES[input.category]

    // Three milestones, each anchored to the first week of its phase band.
    const milestones: Milestone[] = tpl.phases.map((phase, i) => ({
      id: uid('ms'),
      title: phase.title,
      cadence: phase.cadence(input.dailyHours),
      week: Math.max(1, Math.round((i / 3) * weeks) + 1),
      done: false,
    }))

    const dailyAllocation: DailyAllocation[] = []
    for (let i = 0; i < totalDays; i++) {
      const date = addDays(input.startDate, i)
      const phase = phaseOf(i, totalDays) as 0 | 1 | 2
      dailyAllocation.push({
        date,
        hours: input.dailyHours,
        summary: tpl.daySummary(phase, input.dailyHours),
        phase,
      })
    }

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
}
