/* Mock Planner — decomposes a goal into milestones + daily allocation.

   Deterministic, offline. The real Planner would build a decomposition prompt
   from PlannerInput, call the ReasoningEngine, and parse a structured Plan. */

import type {
  DailyAllocation,
  GoalCategory,
  Milestone,
  Plan,
} from '../../../types'
import { addDays, daysBetween, formatHours, uid } from '../../util'
import { delay } from '../reasoning'
import type { PlannerAgent, PlannerInput } from '../types'

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

export class MockPlanner implements PlannerAgent {
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
