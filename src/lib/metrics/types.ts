import type {
  ExperimentGroup,
  GoalCategory,
  Persona,
  PersonaOrder,
} from '../../types'

export type MetricStep = 'goal' | 'period' | 'hours' | 'persona' | 'plan'

export type MetricBackend = 'mock' | 'openai'

export interface ObjectiveMetrics {
  subtaskCount: number
  subtasksPerDayMean: number
  subtasksPerDaySd: number
  taskDurationMeanMin: number
  taskDurationSdMin: number
  planSpanDays: number
  milestoneCount: number
  subjectCount: number
  actionableTaskCount: number
  actionableTaskRate: number
  specificityScoreMean: number
  timeClarityScore: number
  priorityClarityScore: number
}

export interface SurveyResponse {
  preBurden: number | null
  postBurden: number | null
  confidence: number | null
  planClarity: number | null
  immediateActionability: number | null
  nasaTlxMental: number | null
  nasaTlxTemporal: number | null
  nasaTlxEffort: number | null
  nasaTlxFrustration: number | null
}

export interface MetricsPayload {
  sessionId: string
  planId: string
  timestamp: string
  participantId: string
  appVersion: string
  backend: MetricBackend

  experimentGroup: ExperimentGroup | null
  persona: Persona
  personaOrder: PersonaOrder | null
  rewardEnabled: boolean

  goalText: string
  shortTitle: string
  goalCategory: GoalCategory
  planSpanDays: number
  dailyHours: number
  subjectCount: number
  milestoneCount: number

  planDurationSec: number
  timeOnGoalSec: number
  timeOnPeriodSec: number
  timeOnHoursSec: number
  timeOnPersonaSec: number
  timeOnPlanSec: number
  planGenerationSec: number
  goalParseSec: number

  revisionCount: number
  planRegenerationCount: number
  missionAddCount: number
  missionEditCount: number
  missionDeleteCount: number
  totalMissionEdits: number
  retryCount: number

  subtaskCount: number
  subtasksPerDayMean: number
  subtasksPerDaySd: number
  taskDurationMeanMin: number
  taskDurationSdMin: number

  actionableTaskCount: number
  actionableTaskRate: number
  specificityScoreMean: number
  timeClarityScore: number
  priorityClarityScore: number

  preBurden: number | null
  postBurden: number | null
  burdenReduction: number | null
  confidence: number | null
  planClarity: number | null
  immediateActionability: number | null
  nasaTlxMental: number | null
  nasaTlxTemporal: number | null
  nasaTlxEffort: number | null
  nasaTlxFrustration: number | null
  preSurveyCompleted: boolean
  postSurveyCompleted: boolean

  locale: string
  userAgent: string
  rawJson: string
}
