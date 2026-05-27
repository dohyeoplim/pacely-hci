import type { Goal, UserEvent } from '../../types'
import type {
  AdjusterAgent,
  AnalyzerAgent,
  DialogueAgent,
  Orchestrator,
  OrchestratorResult,
  PlannerAgent,
} from './types'

interface Deps {
  planner: PlannerAgent
  dialogue: DialogueAgent
  adjuster: AdjusterAgent
  analyzer: AnalyzerAgent
}

export class MockOrchestrator implements Orchestrator {
  private readonly deps: Deps
  constructor(deps: Deps) {
    this.deps = deps
  }

  async handleEvent(
    event: UserEvent,
    goal: Goal | null,
    recentEvents: UserEvent[],
  ): Promise<OrchestratorResult> {
    const result: OrchestratorResult = { notifications: [], insights: [] }
    if (!goal) return result

    const log = [...recentEvents, event]

    switch (event.type) {
      case 'app_open':
      case 'day_started': {
        const noti = await this.deps.adjuster.generateNotification({
          goal,
          recentEvents: log,
        })
        if (noti) result.notifications.push(noti)
        break
      }

      case 'mission_missed': {
        const insights = await this.deps.analyzer.extractPatterns(log)
        result.insights = insights

        const slump = insights.find((i) => i.kind === 'afternoon_focus_drop')
        if (slump) {
          result.replannedPlan = await this.deps.adjuster.replan(goal, slump)
        }

        const noti = await this.deps.adjuster.generateNotification({
          goal,
          recentEvents: log,
        })
        if (noti) result.notifications.push(noti)
        break
      }

      case 'mission_completed': {
        if (event.payload?.milestoneReached) {
          const noti = await this.deps.adjuster.generateNotification({
            goal,
            recentEvents: log,
          })
          if (noti) result.notifications.push(noti)
        }
        break
      }

      default:
        break
    }

    return result
  }
}

export type { UserEvent }
