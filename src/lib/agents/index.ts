/* Agent system entry point.

   Consumers call `getAgents()` and depend only on the `Agents` interface.
   The active implementation is picked once at boot based on the
   `VITE_USE_LLM` env flag:

     VITE_USE_LLM=true   → real OpenAI-backed bundle (calls /api/llm)
     anything else       → deterministic mock bundle (good for demos / GA group)
*/

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
  /* The orchestrator routing logic stays identical — only the agents
     it composes are swapped out. */
  const orchestrator = new MockOrchestrator({
    planner,
    dialogue,
    adjuster,
    analyzer,
  })
  return { planner, dialogue, adjuster, analyzer, orchestrator }
}

function shouldUseLLM(): boolean {
  /* Vite inlines import.meta.env at build time. The flag is a string. */
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
  PlannerAgent,
  PlannerInput,
  ReasoningEngine,
} from './types'
