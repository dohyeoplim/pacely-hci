import type {
  Experiment,
  GoalCategory,
  MissionTask,
  Persona,
  Plan,
} from '../../types'

import { analyzePlan } from './analyzer'
import type { MetricSessionSnapshot } from './collector'
import type { MetricBackend, MetricsPayload, SurveyResponse } from './types'

const APP_VERSION = '0.1.0-prototype'

function detectBackend(): MetricBackend {
  return import.meta.env.VITE_USE_LLM === 'true' ? 'openai' : 'mock'
}

function safeUserAgent(): string {
  if (typeof navigator === 'undefined') return ''
  return navigator.userAgent.slice(0, 240)
}

function safeLocale(): string {
  if (typeof navigator === 'undefined') return 'unknown'
  return navigator.language || 'unknown'
}

function nowIsoWithOffset(): string {
  // Local-time ISO with timezone offset; Notion's `date.start` accepts this
  // verbatim and lets us pivot by local day rather than UTC day.
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const tz = -d.getTimezoneOffset()
  const sign = tz >= 0 ? '+' : '-'
  const tzAbs = Math.abs(tz)
  const tzh = pad(Math.floor(tzAbs / 60))
  const tzm = pad(tzAbs % 60)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${tzh}:${tzm}`
  )
}

const toSec = (ms: number | null | undefined): number => {
  if (!ms || !Number.isFinite(ms)) return 0
  return Math.round(ms) / 1000
}

const subtract = (
  end: number | null | undefined,
  start: number | null | undefined,
): number => {
  if (end == null || start == null) return 0
  return Math.max(0, end - start)
}

export interface BuildInputs {
  /** Closed metric session. */
  snapshot: MetricSessionSnapshot
  plan: Plan
  missions: MissionTask[]
  goalText: string
  shortTitle: string
  goalCategory: GoalCategory
  persona: Persona
  dailyHours: number
  planId: string
  experiment: Experiment
  /** Survey responses, partial — null fields are logged as null. */
  survey: SurveyResponse
  preSurveyCompleted: boolean
  postSurveyCompleted: boolean
}

export function buildMetricsPayload(inputs: BuildInputs): MetricsPayload {
  const {
    snapshot,
    plan,
    missions,
    goalText,
    shortTitle,
    goalCategory,
    persona,
    dailyHours,
    planId,
    experiment,
    survey,
    preSurveyCompleted,
    postSurveyCompleted,
  } = inputs

  const objective = analyzePlan(plan, missions)
  const t = snapshot.timings
  const ix = snapshot.interactions

  const burdenReduction =
    survey.preBurden != null && survey.postBurden != null
      ? survey.preBurden - survey.postBurden
      : null

  // We embed a compact JSON dump so a researcher can re-derive any metric
  // from a single Notion row without joining external tables.
  const rawJson = JSON.stringify({
    timings: snapshot.timings,
    interactions: snapshot.interactions,
    objective,
    survey,
    plan: {
      milestones: plan.milestones.length,
      dailyAllocation: plan.dailyAllocation.length,
      subjects: plan.subjects,
      weeks: plan.weeks,
      period: plan.period,
    },
    missionCount: missions.length,
  })

  return {
    sessionId: snapshot.sessionId,
    planId,
    timestamp: nowIsoWithOffset(),
    participantId: experiment.participantId,
    appVersion: APP_VERSION,
    backend: detectBackend(),

    experimentGroup: experiment.group,
    persona,
    personaOrder: experiment.personaOrder,
    rewardEnabled: experiment.rewardEnabled,

    goalText,
    shortTitle,
    goalCategory,
    planSpanDays: plan.period.totalDays,
    dailyHours,
    subjectCount: plan.subjects.length,
    milestoneCount: plan.milestones.length,

    planDurationSec: toSec(snapshot.endedAt - snapshot.startedAt),
    timeOnGoalSec: toSec(t.cumulativeMs.goal),
    timeOnPeriodSec: toSec(t.cumulativeMs.period),
    timeOnHoursSec: toSec(t.cumulativeMs.hours),
    timeOnPersonaSec: toSec(t.cumulativeMs.persona),
    timeOnPlanSec: toSec(t.cumulativeMs.plan),
    planGenerationSec: toSec(subtract(t.planGenEndAt, t.planGenStartAt)),
    goalParseSec: toSec(subtract(t.parseEndAt, t.parseStartAt)),

    revisionCount: ix.revisionCount,
    planRegenerationCount: ix.planRegenerationCount,
    missionAddCount: ix.missionAddCount,
    missionEditCount: ix.missionEditCount,
    missionDeleteCount: ix.missionDeleteCount,
    totalMissionEdits:
      ix.missionAddCount + ix.missionEditCount + ix.missionDeleteCount,
    retryCount: ix.retryCount,

    subtaskCount: objective.subtaskCount,
    subtasksPerDayMean: objective.subtasksPerDayMean,
    subtasksPerDaySd: objective.subtasksPerDaySd,
    taskDurationMeanMin: objective.taskDurationMeanMin,
    taskDurationSdMin: objective.taskDurationSdMin,

    actionableTaskCount: objective.actionableTaskCount,
    actionableTaskRate: objective.actionableTaskRate,
    specificityScoreMean: objective.specificityScoreMean,
    timeClarityScore: objective.timeClarityScore,
    priorityClarityScore: objective.priorityClarityScore,

    preBurden: survey.preBurden,
    postBurden: survey.postBurden,
    burdenReduction,
    confidence: survey.confidence,
    planClarity: survey.planClarity,
    immediateActionability: survey.immediateActionability,
    nasaTlxMental: survey.nasaTlxMental,
    nasaTlxTemporal: survey.nasaTlxTemporal,
    nasaTlxEffort: survey.nasaTlxEffort,
    nasaTlxFrustration: survey.nasaTlxFrustration,
    preSurveyCompleted,
    postSurveyCompleted,

    locale: safeLocale(),
    userAgent: safeUserAgent(),
    rawJson,
  }
}
