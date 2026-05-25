/* ===========================================================================
   Pacely — Domain Data Models
   Mirrors the data model in the feature spec (§4).
   =========================================================================== */

export type Persona = 'gentle' | 'strict'

export type GoalCategory = 'project' | 'workout' | 'exam' | 'diary' | 'custom'

export type GoalStatus = 'active' | 'finished' | 'abandoned'

/** ISO date string, e.g. "2026-05-15" */
export type ISODate = string

/* --- Planning -------------------------------------------------------------*/

export interface Milestone {
  id: string
  /** e.g. "전 범위 1회독" */
  title: string
  /** e.g. "주 5일 · 하루 3시간" */
  cadence: string
  /** ordinal week this milestone covers, 1-based */
  week: number
  done: boolean
}

export interface DailyAllocation {
  date: ISODate
  /** planned focus hours for the day */
  hours: number
  /** human-readable summary of the day's load */
  summary: string
  /** 0 = ramp-up, 1 = core, 2 = wrap-up — drives mission action verbs */
  phase: 0 | 1 | 2
}

export interface Plan {
  id: string
  goalText: string
  period: { startDate: ISODate; endDate: ISODate; totalDays: number }
  milestones: Milestone[]
  dailyAllocation: DailyAllocation[]
  persona: Persona
  /** weeks the plan spans — derived, kept for plan-card header */
  weeks: number
  /** subjects / phases the user wants the plan rotated across */
  subjects: string[]
}

/* --- Execution ------------------------------------------------------------*/

export interface MissionTask {
  id: string
  /** e.g. "선형대수 고유값 증명 정리" */
  title: string
  /** estimated minutes */
  estimatedMinutes: number
  /** ISO date this mission belongs to */
  date: ISODate
  completed: boolean
  completedAt?: number
}

export interface Progress {
  completedTaskIds: string[]
  /** 0..1 — completed days / elapsed days */
  adherenceRate: number
  /** the Social Facilitation comparison: companion vs user hours, cumulative */
  pacelyVsUserHours: { user: number; pacely: number }
  /** cumulative focus hours logged across the whole goal */
  totalHours: number
  /** count of days the user showed up alongside Pacely */
  daysWithPacely: number
  /** consecutive missed-mission days — feeds the Adjuster's procrastination trigger */
  missedStreak: number
  /** current consecutive showed-up days, including today if any mission done */
  currentStreak: number
  /** longest streak ever reached on this goal */
  bestStreak: number
}

/* --- Goal (aggregate root) ------------------------------------------------*/

export interface Goal {
  id: string
  title: string
  category: GoalCategory
  startDate: ISODate
  endDate: ISODate
  plan: Plan
  /** concrete daily mission checklist, generated from the plan */
  missions: MissionTask[]
  progress: Progress
  status: GoalStatus
  createdAt: number
}

/* --- Notifications (Adjuster output) -------------------------------------*/

export type TriggerCategory =
  | 'entry' // 진입 유도
  | 'milestone' // 마일스톤 도달
  | 'stats' // 통계 기반 격려
  | 'dday' // D-day 리마인더
  | 'procrastination' // 미루기 감지
  | 'emotion' // 감정 케어
  | 'social' // 사회적 촉진
  | 'lowburden' // 부담 감소 시작

export interface PacelyNotification {
  id: string
  trigger: TriggerCategory
  message: string
  persona: Persona
  createdAt: number
  read: boolean
}

/* --- Co-Reward ------------------------------------------------------------*/

export interface Reward {
  id: string
  sourceGoalId: string
  partnerName: string
  emoji: string
  title: string
  /** human-readable value, e.g. "Americano 1잔", "20% 할인" */
  value: string
  category: GoalCategory
  redeemed: boolean
  expiryDate: ISODate
  createdAt: number
}

export interface PacelyAvatar {
  level: number
  /** completed goals that contributed to growth */
  accumulatedSessions: number
  traits: string[]
  /** drives avatar color theme */
  themeCategory: GoalCategory
}

export interface Battle {
  id: string
  goalTitle: string
  /** what's on the line, e.g. "커피 한 잔" */
  stake: string
  status: 'active' | 'won' | 'lost'
  opponent: {
    name: string
    persona: 'fast' | 'steady' | 'casual'
    /** 0..1 — synthesized progress simulated from elapsed time */
    progress: number
  }
  /** 0..1 — snapshot of user adherence at resolve time */
  userProgress: number
  startedAt: number
  resolvedAt?: number
}

/* --- Memory layer ---------------------------------------------------------*/

export interface MemoryRecord {
  userId: string
  shortTerm: string[]
  longTerm: string[]
  profile: Record<string, unknown>
}

/* --- User -----------------------------------------------------------------*/

export interface User {
  id: string
  name: string
  personaPreference: Persona
}

/* --- Event stream (Orchestrator input) -----------------------------------*/

export type UserEventType =
  | 'app_open'
  | 'app_close'
  | 'mission_completed'
  | 'mission_uncompleted'
  | 'mission_missed'
  | 'day_started'
  | 'plan_created'
  | 'goal_finished'

export interface UserEvent {
  type: UserEventType
  at: number
  goalId?: string
  payload?: Record<string, unknown>
}

/* --- Experiment (HCI study) ----------------------------------------------*/

export type ExperimentGroup = 'GA' | 'GB' | 'GC'
export type Lab1Order = 'companion-first' | 'coach-first'
export type Lab2Condition = 'G1' | 'G2' | 'G3'

export interface Experiment {
  /** Empty string when not in a study. */
  participantId: string
  group: ExperimentGroup | null
  lab1Order: Lab1Order | null
  lab2Condition: Lab2Condition | null
  /** GC hides reward UI; GB shows it. Used as the source of truth even when
      group changes mid-study, so the researcher can override. */
  rewardEnabled: boolean
}
