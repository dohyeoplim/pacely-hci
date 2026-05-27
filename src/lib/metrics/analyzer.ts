import type { MissionTask, Plan } from '../../types'

import type { ObjectiveMetrics } from './types'

/* ──────────────────── Heuristic plan-quality scoring ────────────────────

   Three objective heuristics are computed per mission and aggregated.
   They are *signals*, not ground truth — they correlate with concepts
   from goal-setting theory (specificity, proximity, decomposition) and
   cognitive-load theory (chunk size, working-memory load).

   Specificity  — does the task name an action + a quantifier + an object?
                  Grounded in Locke & Latham's goal-specificity construct.
   Time clarity — is the work chunked into doable units (10–90 min)
                  and is the time made explicit in the title?
                  Grounded in implementation-intention research (Gollwitzer).
   Priority cl. — does the plan signal ordering (phase warmup→focus→closer),
                  milestone scaffolding, and a sane task volume per day?
                  Grounded in cognitive-load theory (intrinsic load mgmt). */

// Korean action verbs (matches common Pacely mission phrasings + free input).
const VERB_PAT =
  /(하기|적기|풀기|쓰기|만들기|읽기|보기|짜기|풀이|정리|점검|찾기|보충|훑기|시도|기록|체크|복습|디버깅|마무리|정의|준비|훑어보고|연습|작성|확인|검토|구현|설계|발표|제출)/

// Numeric quantifier + Korean unit.
const QUANT_PAT = /\d+\s*(분|시간|개|세트|회|문제|줄|단원|페이지|쪽|세션|단계|챕터)/

// Object marker: any Hangul/alnum token followed by Korean particle.
const OBJECT_PAT = /[가-힣A-Za-z]+\s*(을|를|이|가|은|는|에|의|로|으로|에서)/

// Explicit time mention in the title (분/시간).
const TIME_MENTION_PAT = /\d+\s*(분|시간)/

const round = (x: number, places = 2): number => {
  const k = 10 ** places
  return Math.round(x * k) / k
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function sd(xs: number[]): number {
  if (xs.length === 0) return 0
  const m = mean(xs)
  const v = mean(xs.map((x) => (x - m) ** 2))
  return Math.sqrt(v)
}

/* Specificity score in [0,1].
   Weights are equal-ish so a task with any two of the three signals
   crosses the actionability threshold (0.66). */
export function specificityScore(title: string): number {
  let s = 0
  if (VERB_PAT.test(title)) s += 0.4
  if (QUANT_PAT.test(title)) s += 0.3
  if (OBJECT_PAT.test(title)) s += 0.3
  return s
}

const ACTIONABILITY_THRESHOLD = 0.66

function subtasksPerDay(missions: MissionTask[]): number[] {
  const byDay = new Map<string, number>()
  for (const m of missions) byDay.set(m.date, (byDay.get(m.date) ?? 0) + 1)
  return [...byDay.values()]
}

function timeClarity(missions: MissionTask[]): number {
  if (missions.length === 0) return 0
  // Chunked into a doable window: 10–90 min lines up with the Pomodoro/
  // deep-work literature and Pacely's planner's own slot sizing.
  const chunkOk = missions.filter(
    (m) => m.estimatedMinutes >= 10 && m.estimatedMinutes <= 90,
  ).length
  const explicit = missions.filter((m) => TIME_MENTION_PAT.test(m.title)).length
  return 0.6 * (chunkOk / missions.length) + 0.4 * (explicit / missions.length)
}

function priorityClarity(
  plan: Plan,
  missions: MissionTask[],
  perDay: number[],
): number {
  // 1) Phase diversity — does the plan use warmup/focus/closer arcs?
  const phases = new Set(plan.dailyAllocation.map((d) => d.phase))
  const phaseDiversity = phases.size / 3

  // 2) Milestone density — at least ~one milestone per week scaffolds priorities.
  const milestoneDensity = plan.weeks === 0 ? 0 : Math.min(1, plan.milestones.length / plan.weeks)

  // 3) Sane daily volume — ≤5 tasks/day stays inside Miller's 7±2;
  //    the sweet spot is around 3 per day. Score peaks there.
  const tpd = mean(perDay.length === 0 ? [missions.length] : perDay)
  const volumeScore =
    tpd <= 0
      ? 0
      : tpd <= 5
        ? 1 - Math.abs(tpd - 3) / 5
        : Math.max(0, 1 - (tpd - 5) / 5)

  return 0.4 * phaseDiversity + 0.3 * milestoneDensity + 0.3 * Math.max(0, volumeScore)
}

export function analyzePlan(
  plan: Plan,
  missions: MissionTask[],
): ObjectiveMetrics {
  const total = missions.length
  const durations = missions.map((m) => m.estimatedMinutes)
  const specs = missions.map((m) => specificityScore(m.title))
  const actionable = specs.filter((s) => s >= ACTIONABILITY_THRESHOLD).length
  const perDay = subtasksPerDay(missions)

  return {
    subtaskCount: total,
    subtasksPerDayMean: round(mean(perDay.length === 0 ? [total] : perDay)),
    subtasksPerDaySd: round(sd(perDay)),
    taskDurationMeanMin: round(mean(durations), 1),
    taskDurationSdMin: round(sd(durations), 1),
    planSpanDays: plan.period.totalDays,
    milestoneCount: plan.milestones.length,
    subjectCount: plan.subjects.length,
    actionableTaskCount: actionable,
    actionableTaskRate: total === 0 ? 0 : round(actionable / total),
    specificityScoreMean: round(mean(specs)),
    timeClarityScore: round(timeClarity(missions)),
    priorityClarityScore: round(priorityClarity(plan, missions, perDay)),
  }
}
