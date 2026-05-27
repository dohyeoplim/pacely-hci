/* Sub-task generator — Pacely's core HCI value.

   A real Planner agent would call an LLM and return a structured day-by-day
   breakdown. This mock approximates that by composing concrete, action-verb
   sub-tasks from per-category / per-phase recipe libraries, then rotating
   them across days so consecutive days never read identically. Each day's
   sub-task minutes sum to the day's planned hours.

   Design rules (drawn from the experiment plan §6 LAB2-S/L rubric):
     1. The first sub-task of every day is an "immediately actionable" warm-up
        (15-25 min) so the participant can start without thinking.
     2. Each sub-task title contains a verb + a concrete object — never
        vague nouns like "공부" or "자료 준비".
     3. Subjects rotate so a day rarely repeats yesterday's exact mix —
        gives the plan a personalised feel beyond what Notion / paper offers.
*/

import type { GoalCategory, MissionTask, Plan } from '../../types'
import { uid } from '../util'

/* --- Building blocks per phase ------------------------------------------*/

type Phase = 0 | 1 | 2

interface PhaseRecipe {
  /** Light warm-up that's always doable in 15-25 minutes. */
  warmup: (subject?: string) => string
  /** 2-3 deeper focus blocks for the bulk of the day. */
  focus: ((subject?: string) => string)[]
  /** Optional consolidation/review task at the end. */
  closer?: (subject?: string) => string
}

const SUBJECT_PHASES: Record<Phase, PhaseRecipe> = {
  0: {
    warmup: (s) => (s ? `${s} 목차 훑어보고 핵심 용어 5개 적어두기` : '오늘 목차 훑어보고 핵심 용어 5개 적기'),
    focus: [
      (s) => (s ? `${s} 1단원 개념 정리노트 만들기` : '1단원 개념 정리노트 만들기'),
      (s) => (s ? `${s} 예제 3문제 풀고 풀이 과정 적기` : '예제 3문제 풀고 풀이 과정 적기'),
      (s) => (s ? `${s} 헷갈리는 부분 형광펜으로 표시` : '헷갈리는 부분 형광펜으로 표시'),
    ],
    closer: (s) => (s ? `${s} 오늘 배운 것 한 줄 요약` : '오늘 배운 것 한 줄 요약'),
  },
  1: {
    warmup: (s) => (s ? `${s} 어제 정리한 노트 5분 훑기` : '어제 정리한 노트 5분 훑기'),
    focus: [
      (s) => (s ? `${s} 핵심 문제 10문제 풀이` : '핵심 문제 10문제 풀이'),
      (s) => (s ? `${s} 오답노트 정리 + 다시 풀기` : '오답 다시 풀고 풀이 적기'),
      (s) => (s ? `${s} 약점 단원 집중 복습 (1시간)` : '약점 단원 집중 복습 (1시간)'),
    ],
    closer: (s) => (s ? `${s} 모의문제 1세트 시간 재고 풀기` : '모의문제 1세트 시간 재고 풀기'),
  },
  2: {
    warmup: (s) => (s ? `${s} 핵심 요약본 다시 읽기 (15분)` : '핵심 요약본 다시 읽기 (15분)'),
    focus: [
      (s) => (s ? `${s} 기출 3년치 1회독` : '기출 3년치 1회독'),
      (s) => (s ? `${s} 자주 틀린 유형 3개 마지막 점검` : '자주 틀린 유형 3개 마지막 점검'),
    ],
    closer: (s) => (s ? `${s} 컨디션 정리 + 일찍 자기` : '컨디션 정리 + 일찍 자기'),
  },
}

const PROJECT_PHASES: Record<Phase, PhaseRecipe> = {
  0: {
    warmup: (s) => (s ? `${s} 단계 목표 한 문장으로 적기` : '오늘 목표 한 문장으로 적기'),
    focus: [
      (s) => (s ? `${s} 관련 사례 3개 찾고 인사이트 정리` : '관련 사례 3개 찾고 인사이트 정리'),
      (s) => (s ? `${s} 핵심 가설 / 가정 3개 적어두기` : '핵심 가설 / 가정 3개 적어두기'),
      () => '범위와 산출물 한 페이지 스케치',
    ],
    closer: () => '오늘 발견 / 결정 사항 1줄 기록',
  },
  1: {
    warmup: (s) => (s ? `${s} 어제 작업 미리보기 + 오늘 첫 30분 작업 정의` : '어제 작업 미리보기 + 오늘 첫 30분 작업 정의'),
    focus: [
      (s) => (s ? `${s} 핵심 기능 / 산출물 하나 끝내기` : '핵심 산출물 하나 끝내기'),
      (s) => (s ? `${s} 막힌 부분 30분 디버깅 + 메모` : '막힌 부분 30분 디버깅 + 메모'),
      () => '진행 상황 캡처 + 다음 할 일 1개 적기',
    ],
    closer: () => '오늘의 작업물 PR / 폴더에 정리',
  },
  2: {
    warmup: () => '체크리스트 펼치고 남은 항목 색칠하기',
    focus: [
      (s) => (s ? `${s} 마무리 다듬기 + 누락 항목 채우기` : '마무리 다듬기 + 누락 항목 채우기'),
      () => '데모용 시나리오 1회 리허설',
    ],
    closer: () => '회고 3줄 (잘된 것 / 아쉬운 것 / 다음에)',
  },
}

const WORKOUT_PHASES: Record<Phase, PhaseRecipe> = {
  0: {
    warmup: () => '동적 스트레칭 10분',
    focus: [
      () => '걷기 / 가벼운 유산소 25분',
      () => '코어 운동 3세트 × 15회',
    ],
    closer: () => '정적 스트레칭 + 컨디션 1~5 점수 기록',
  },
  1: {
    warmup: () => '관절 풀기 + 가볍게 5분 점프',
    focus: [
      () => '메인 근력 3세트 (점진적 과부하)',
      () => '인터벌 유산소 20분',
      () => '취약 부위 보조 2세트',
    ],
    closer: () => '폼롤러 + 단백질 보충',
  },
  2: {
    warmup: () => '루틴 동작 익히기 (10분)',
    focus: [
      () => '한 세션 분량 풀코스 실행',
    ],
    closer: () => '체중 / 사진 기록 + 다음 주 메뉴 정하기',
  },
}

const DIARY_PHASES: Record<Phase, PhaseRecipe> = {
  0: {
    warmup: () => '오늘 기분 한 단어 적기',
    focus: [() => '오늘 가장 또렷한 장면 3줄로 적기'],
    closer: () => '내일 시작할 한 가지 적기',
  },
  1: {
    warmup: () => '어제 기록 빠르게 훑기',
    focus: [
      () => '오늘의 발견 / 배운 점 5줄',
      () => '감정 라벨 + 트리거 한 줄',
    ],
  },
  2: {
    warmup: () => '한 주 키워드 5개 적기',
    focus: [() => '한 주 회고 (잘된 것 / 아쉬운 것 / 시도할 것)'],
  },
}

const CUSTOM_PHASES: Record<Phase, PhaseRecipe> = {
  0: {
    warmup: () => '오늘의 목표를 한 문장으로 다시 적기',
    focus: [
      () => '첫 단계 가볍게 시작 (25분)',
      () => '필요한 자원 / 도구 정리',
    ],
    closer: () => '오늘 한 줄 메모',
  },
  1: {
    warmup: () => '어제 한 일 5분 훑기',
    focus: [
      () => '오늘 핵심 작업 몰입 (45분 × 2회)',
      () => '진행 상황 캡처 + 다음 액션 적기',
    ],
    closer: () => '내일 첫 30분에 할 일 정하기',
  },
  2: {
    warmup: () => '체크리스트 점검',
    focus: [() => '마무리 작업 끝내기'],
    closer: () => '회고 3줄',
  },
}

const RECIPES: Record<GoalCategory, Record<Phase, PhaseRecipe>> = {
  exam: SUBJECT_PHASES,
  project: PROJECT_PHASES,
  workout: WORKOUT_PHASES,
  diary: DIARY_PHASES,
  custom: CUSTOM_PHASES,
}

/* --- Time distribution --------------------------------------------------*/

/** Spread a day's total minutes across N tasks with a warm-up that's at most
   25 min and a closer that's roughly 10-15% of the day. */
function distributeMinutes(totalMin: number, count: number): number[] {
  if (count <= 1) return [totalMin]
  const warmup = Math.min(25, Math.round(totalMin * 0.12))
  const closer = count >= 3 ? Math.min(20, Math.round(totalMin * 0.1)) : 0
  const focusCount = count - 1 - (closer > 0 ? 1 : 0)
  const focusTotal = Math.max(15 * focusCount, totalMin - warmup - closer)
  const perFocus = Math.max(15, Math.round(focusTotal / focusCount))

  const out: number[] = [warmup]
  for (let i = 0; i < focusCount; i++) out.push(perFocus)
  if (closer > 0) out.push(closer)

  // Adjust last focus block so the sum matches the day total within ±5 min.
  const drift = totalMin - out.reduce((s, n) => s + n, 0)
  if (focusCount > 0) {
    out[focusCount] = Math.max(15, out[focusCount] + drift)
  }
  return out
}

/* --- Public API ---------------------------------------------------------*/

export function generateMissions(plan: Plan, category: GoalCategory): MissionTask[] {
  const subjects = plan.subjects
  const missions: MissionTask[] = []

  plan.dailyAllocation.forEach((day, dayIndex) => {
    const totalMin = Math.round(day.hours * 60)
    const phase = day.phase
    const recipe = RECIPES[category][phase]

    /* Choose 1-2 subjects to focus on today (rotation gives a personalised
       feel — paper / Notion can't do this). */
    const todaysSubjects: (string | undefined)[] =
      subjects.length === 0
        ? [undefined]
        : subjects.length === 1
          ? [subjects[0]]
          : [
              subjects[dayIndex % subjects.length],
              subjects[(dayIndex + 1) % subjects.length],
            ]

    /* Build a per-day task list: warmup + N focus + optional closer.
       For longer days (>3h) we add a second focus block; for very short
       days (<=1.5h) we collapse to warmup + one focus. */
    const focusSlots = totalMin <= 90 ? 1 : totalMin <= 240 ? 2 : 3
    const includeCloser = totalMin >= 120 && !!recipe.closer
    const taskCount = 1 + focusSlots + (includeCloser ? 1 : 0)
    const allocations = distributeMinutes(totalMin, taskCount)

    /* Pick the warmup once (uses the first subject if any). */
    const warmupSubject = todaysSubjects[0]
    const titles: string[] = [recipe.warmup(warmupSubject)]

    /* Fill focus slots by walking through recipe.focus, paired with
       rotating subjects so each block reads distinctly. */
    for (let i = 0; i < focusSlots; i++) {
      const focusFn = recipe.focus[(dayIndex + i) % recipe.focus.length]
      const subj = todaysSubjects[i % todaysSubjects.length]
      titles.push(focusFn(subj))
    }

    if (includeCloser && recipe.closer) {
      titles.push(recipe.closer(warmupSubject))
    }

    titles.forEach((title, i) => {
      missions.push({
        id: uid('m'),
        title,
        estimatedMinutes: allocations[i] ?? 30,
        date: day.date,
        completed: false,
      })
    })
  })

  return missions
}

export function missionsForDate(
  missions: MissionTask[],
  date: string,
): MissionTask[] {
  return missions.filter((m) => m.date === date)
}
