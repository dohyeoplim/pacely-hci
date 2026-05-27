export type Persona = 'gentle' | 'strict'

export type GoalCategory = 'project' | 'workout' | 'exam' | 'diary' | 'custom'

export type GoalStatus = 'active' | 'finished' | 'abandoned'

export type ISODate = string

export interface Milestone {
  id: string
  title: string
  cadence: string
  week: number
  done: boolean
}

export interface DailyAllocation {
  date: ISODate
  hours: number
  summary: string
  phase: 0 | 1 | 2
}

export interface Plan {
  id: string
  goalText: string
  period: { startDate: ISODate; endDate: ISODate; totalDays: number }
  milestones: Milestone[]
  dailyAllocation: DailyAllocation[]
  persona: Persona
  weeks: number
  subjects: string[]
}

export interface MissionTask {
  id: string
  title: string
  estimatedMinutes: number
  date: ISODate
  completed: boolean
  completedAt?: number
}

export interface Progress {
  completedTaskIds: string[]
  adherenceRate: number
  pacelyVsUserHours: { user: number; pacely: number }
  totalHours: number
  daysWithPacely: number
  missedStreak: number
  currentStreak: number
  bestStreak: number
}

export interface Goal {
  id: string
  title: string
  category: GoalCategory
  startDate: ISODate
  endDate: ISODate
  plan: Plan
  missions: MissionTask[]
  progress: Progress
  status: GoalStatus
  createdAt: number
}

export type TriggerCategory =
  | 'entry'
  | 'milestone'
  | 'stats'
  | 'dday'
  | 'procrastination'
  | 'emotion'
  | 'social'
  | 'lowburden'

export interface PacelyNotification {
  id: string
  trigger: TriggerCategory
  message: string
  persona: Persona
  createdAt: number
  read: boolean
}

export interface Reward {
  id: string
  sourceGoalId: string
  partnerName: string
  emoji: string
  title: string
  value: string
  category: GoalCategory
  redeemed: boolean
  expiryDate: ISODate
  createdAt: number
}

export interface PacelyAvatar {
  level: number
  accumulatedSessions: number
  traits: string[]
  themeCategory: GoalCategory
}

export interface Battle {
  id: string
  goalTitle: string
  stake: string
  status: 'active' | 'won' | 'lost'
  opponent: {
    name: string
    persona: 'fast' | 'steady' | 'casual'
    progress: number
  }
  userProgress: number
  startedAt: number
  resolvedAt?: number
}

export interface MemoryRecord {
  userId: string
  shortTerm: string[]
  longTerm: string[]
  profile: Record<string, unknown>
}

export interface User {
  id: string
  name: string
  personaPreference: Persona
}

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

export type ExperimentGroup = 'template' | 'pacely'
export type PersonaOrder = 'companion-first' | 'coach-first'

export interface Experiment {
  participantId: string
  group: ExperimentGroup | null
  personaOrder: PersonaOrder | null
  rewardEnabled: boolean
}
