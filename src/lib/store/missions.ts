/* Turns a Plan's daily allocation into a concrete mission checklist.

   - If the plan carries `subjects`, each day gets one mission per subject
     with an action verb shaped by the day's phase (e.g. "선형대수 약점 보완").
   - Otherwise we fall back to the two-mission template (anchor + follow). */

import type { GoalCategory, MissionTask, Plan } from '../../types'
import { uid } from '../util'

/** Two mission title templates per category — anchor + follow. */
const FALLBACK_TITLES: Record<GoalCategory, [string, string]> = {
  exam: ['핵심 개념 정리하기', '연습 문제 풀이'],
  project: ['핵심 작업 진행하기', '진행 내용 정리하기'],
  workout: ['메인 운동 세션', '스트레칭 & 마무리'],
  diary: ['오늘의 기록 작성', '한 줄 회고'],
  custom: ['오늘의 핵심 미션', '마무리 점검'],
}

/** Action verbs per category × plan phase, used when subjects are set. */
const PHASE_ACTIONS: Record<GoalCategory, [string, string, string]> = {
  exam: ['1회독 정리', '약점 보완 + 문제풀이', '마무리 점검'],
  project: ['리서치 + 기획', '구현 진행', '다듬기 + 마감'],
  workout: ['워밍업 세션', '본 운동', '쿨다운 + 회고'],
  diary: ['오늘의 기록', '하루 회고', '한 주 정리'],
  custom: ['가볍게 시작', '본격 진행', '마무리 점검'],
}

export function generateMissions(plan: Plan, category: GoalCategory): MissionTask[] {
  if (plan.subjects.length > 0) {
    return generateSubjectMissions(plan, category)
  }
  return generateTemplateMissions(plan, category)
}

function generateTemplateMissions(
  plan: Plan,
  category: GoalCategory,
): MissionTask[] {
  const [anchor, follow] = FALLBACK_TITLES[category]
  const missions: MissionTask[] = []
  for (const day of plan.dailyAllocation) {
    const totalMin = Math.round(day.hours * 60)
    const anchorMin = Math.round(totalMin * 0.6)
    const followMin = totalMin - anchorMin
    missions.push(
      {
        id: uid('m'),
        title: `${anchor} · ${day.summary}`,
        estimatedMinutes: anchorMin,
        date: day.date,
        completed: false,
      },
      {
        id: uid('m'),
        title: follow,
        estimatedMinutes: followMin,
        date: day.date,
        completed: false,
      },
    )
  }
  return missions
}

function generateSubjectMissions(
  plan: Plan,
  category: GoalCategory,
): MissionTask[] {
  const subjects = plan.subjects
  const actions = PHASE_ACTIONS[category]
  const missions: MissionTask[] = []
  for (const day of plan.dailyAllocation) {
    const totalMin = Math.round(day.hours * 60)
    const perSubject = Math.max(15, Math.round(totalMin / subjects.length))
    const action = actions[day.phase]
    for (const subject of subjects) {
      missions.push({
        id: uid('m'),
        title: `${subject} ${action}`,
        estimatedMinutes: perSubject,
        date: day.date,
        completed: false,
      })
    }
  }
  return missions
}

export function missionsForDate(
  missions: MissionTask[],
  date: string,
): MissionTask[] {
  return missions.filter((m) => m.date === date)
}
