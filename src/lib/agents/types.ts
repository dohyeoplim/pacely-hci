import type {
  Goal,
  GoalCategory,
  ISODate,
  MissionTask,
  PacelyNotification,
  Persona,
  Plan,
  UserEvent,
} from '../../types'

export interface ReasoningEngine {
  readonly name: string
  complete(
    prompt: string,
    opts?: { system?: string; maxTokens?: number },
  ): Promise<string>
}

export interface PlannerInput {
  goalText: string
  category: GoalCategory
  startDate: ISODate
  endDate: ISODate
  dailyHours: number
  persona: Persona
  subjects?: string[]
}

export interface ParseGoalInput {
  goalText: string
  category?: GoalCategory
  persona: Persona
}

export interface ParseGoalResult {
  category: GoalCategory
  /** Short header/title derived from the goal — ≤ 16 chars, used as the
      planning page header and the persisted goal title. */
  shortTitle: string
  greeting: string
  suggestedSubjects: string[]
  suggestedDays: number
  /** Explicit ISO dates when the user's wording carries them (e.g. "다음
      주 월요일부터 2주"). When null, the UI falls back to today →
      today+suggestedDays. */
  suggestedStartDate?: string
  suggestedEndDate?: string
}

export interface PlannerAgent {
  decomposeGoal(input: PlannerInput): Promise<Plan>
  generateMissions?(plan: Plan, category: GoalCategory): Promise<MissionTask[]>
  parseGoal?(input: ParseGoalInput): Promise<ParseGoalResult>
}

export interface DialogueInput {
  utterance: string
  persona: Persona
  context?: string[]
}

export interface DialogueAgent {
  respond(input: DialogueInput): Promise<string>
}

export interface AdjusterContext {
  goal: Goal
  recentEvents: UserEvent[]
}

export interface AdjusterAgent {
  generateNotification(ctx: AdjusterContext): Promise<PacelyNotification | null>
  replan(goal: Goal, insight: Insight): Promise<Plan>
}

export interface Insight {
  id: string
  kind: string
  summary: string
  recommendation: string
}

export interface AnalyzerAgent {
  extractPatterns(events: UserEvent[]): Promise<Insight[]>
}

export interface OrchestratorResult {
  notifications: PacelyNotification[]
  insights: Insight[]
  replannedPlan?: Plan
}

export interface Orchestrator {
  handleEvent(
    event: UserEvent,
    goal: Goal | null,
    recentEvents: UserEvent[],
  ): Promise<OrchestratorResult>
}

export interface Agents {
  planner: PlannerAgent
  dialogue: DialogueAgent
  adjuster: AdjusterAgent
  analyzer: AnalyzerAgent
  orchestrator: Orchestrator
}
