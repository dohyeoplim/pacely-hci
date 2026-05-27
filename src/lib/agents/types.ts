/* ===========================================================================
   Pacely Agent System — I/O contracts (spec §3)

   Consuming code depends ONLY on these interfaces, never on a concrete
   implementation. Today we ship `createMockAgents()`; a future
   `createClaudeAgents(engine)` can drop in behind the same `Agents` type.
   =========================================================================== */

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

/* --- Reasoning backbone (§3.2 Reasoning Engine) --------------------------*/

/**
 * Common LLM inference backbone. The mock engine returns canned text; a real
 * engine would call the Anthropic API (via a route handler, since this is a
 * client-only Vite app today).
 */
export interface ReasoningEngine {
  readonly name: string
  complete(
    prompt: string,
    opts?: { system?: string; maxTokens?: number },
  ): Promise<string>
}

/* --- Planner (§F1, §3.2) -------------------------------------------------*/

export interface PlannerInput {
  goalText: string
  category: GoalCategory
  startDate: ISODate
  endDate: ISODate
  dailyHours: number
  persona: Persona
  /** optional subjects (exam) or phases (project) the plan should rotate */
  subjects?: string[]
}

export interface PlannerAgent {
  /** Decompose a goal into milestones + per-day allocation. */
  decomposeGoal(input: PlannerInput): Promise<Plan>
  /** Optional: generate the day-by-day mission breakdown for the plan.
      LLM-backed planners override this so missions are coherent with the
      plan's narrative; otherwise callers use the local templated fallback. */
  generateMissions?(plan: Plan, category: GoalCategory): Promise<MissionTask[]>
}

/* --- Dialogue (§3.2) ----------------------------------------------------*/

export interface DialogueInput {
  utterance: string
  persona: Persona
  /** optional running context for continuity */
  context?: string[]
}

export interface DialogueAgent {
  respond(input: DialogueInput): Promise<string>
}

/* --- Adjuster (§F2.2, §3.2) ---------------------------------------------*/

export interface AdjusterContext {
  goal: Goal
  /** recent events used to pick the right trigger category */
  recentEvents: UserEvent[]
}

export interface AdjusterAgent {
  /** Produce one context-aware notification for the current state. */
  generateNotification(ctx: AdjusterContext): Promise<PacelyNotification | null>
  /** Re-shape the plan after a detected pattern (e.g. afternoon slumps). */
  replan(goal: Goal, insight: Insight): Promise<Plan>
}

/* --- Analyzer (§3.2) ----------------------------------------------------*/

export interface Insight {
  id: string
  /** machine key, e.g. "afternoon_focus_drop" */
  kind: string
  /** human-readable summary */
  summary: string
  /** suggested trigger conditions / next actions */
  recommendation: string
}

export interface AnalyzerAgent {
  extractPatterns(events: UserEvent[]): Promise<Insight[]>
}

/* --- Orchestrator (§3.1, §3.3) ------------------------------------------*/

export interface OrchestratorResult {
  notifications: PacelyNotification[]
  insights: Insight[]
  replannedPlan?: Plan
}

export interface Orchestrator {
  /** Route a user event through the agent modules and collect their output. */
  handleEvent(
    event: UserEvent,
    goal: Goal | null,
    recentEvents: UserEvent[],
  ): Promise<OrchestratorResult>
}

/* --- Bundle -------------------------------------------------------------*/

export interface Agents {
  planner: PlannerAgent
  dialogue: DialogueAgent
  adjuster: AdjusterAgent
  analyzer: AnalyzerAgent
  orchestrator: Orchestrator
}
