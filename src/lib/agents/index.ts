/* Agent system entry point.

   Consumers call `getAgents()` and depend only on the `Agents` interface.
   Today it returns the mock bundle; swapping in a Claude-backed bundle is a
   one-line change here once `createClaudeAgents` exists. */

import { MockAdjuster } from './mock/adjuster'
import { MockAnalyzer } from './mock/analyzer'
import { MockDialogue } from './mock/dialogue'
import { MockPlanner } from './mock/planner'
import { MockOrchestrator } from './orchestrator'
import type { Agents } from './types'

export function createMockAgents(): Agents {
  const planner = new MockPlanner()
  const dialogue = new MockDialogue()
  const adjuster = new MockAdjuster()
  const analyzer = new MockAnalyzer()
  const orchestrator = new MockOrchestrator({
    planner,
    dialogue,
    adjuster,
    analyzer,
  })
  return { planner, dialogue, adjuster, analyzer, orchestrator }
}

let singleton: Agents | null = null

export function getAgents(): Agents {
  if (!singleton) singleton = createMockAgents()
  return singleton
}

export type {
  Agents,
  AdjusterAgent,
  AnalyzerAgent,
  DialogueAgent,
  Insight,
  Orchestrator,
  OrchestratorResult,
  PlannerAgent,
  PlannerInput,
  ReasoningEngine,
} from './types'
