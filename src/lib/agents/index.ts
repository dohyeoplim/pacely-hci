import { MockAdjuster } from './mock/adjuster'
import { MockAnalyzer } from './mock/analyzer'
import { MockDialogue } from './mock/dialogue'
import { MockPlanner } from './mock/planner'
import { MockOrchestrator } from './orchestrator'
import { OpenAIAdjuster } from './openai/adjuster'
import { OpenAIAnalyzer } from './openai/analyzer'
import { OpenAIDialogue } from './openai/dialogue'
import { OpenAIPlanner } from './openai/planner'
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

export function createOpenAIAgents(): Agents {
  const planner = new OpenAIPlanner()
  const dialogue = new OpenAIDialogue()
  const adjuster = new OpenAIAdjuster()
  const analyzer = new OpenAIAnalyzer()
  const orchestrator = new MockOrchestrator({
    planner,
    dialogue,
    adjuster,
    analyzer,
  })
  return { planner, dialogue, adjuster, analyzer, orchestrator }
}

function shouldUseLLM(): boolean {
  return import.meta.env.VITE_USE_LLM === 'true'
}

let singleton: Agents | null = null

export function getAgents(): Agents {
  if (!singleton) {
    singleton = shouldUseLLM() ? createOpenAIAgents() : createMockAgents()
  }
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
  ParseGoalInput,
  ParseGoalResult,
  PlannerAgent,
  PlannerInput,
  ReasoningEngine,
} from './types'
