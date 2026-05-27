import type {
  Experiment,
  Goal,
  MissionTask,
  Persona,
  TriggerCategory,
} from '../../types'

import { uid } from '../util'
import type { MetricBackend } from './types'

/* ────────────────────── Event types & wire payload ────────────────────── */

export type AppEventType =
  | 'app_session_start'
  | 'app_session_end'
  | 'app_open'
  | 'app_close'
  | 'route_change'
  | 'plan_created'
  | 'plan_revised'
  | 'plan_regenerated'
  | 'day_started'
  | 'mission_completed'
  | 'mission_uncompleted'
  | 'mission_missed'
  | 'mission_added'
  | 'mission_edited'
  | 'mission_deleted'
  | 'sheet_opened'
  | 'sheet_closed'
  | 'notification_received'
  | 'notification_read'
  | 'goal_finished'
  | 'goal_abandoned'
  | 'goal_switched'
  | 'survey_submitted'
  | 'survey_skipped'

export interface EventInput {
  type: AppEventType
  goal?: Goal | null
  mission?: MissionTask | null
  notificationTrigger?: TriggerCategory
  sheetName?: string
  missionWasLate?: boolean
  milestoneReached?: boolean
  /** Free-form structured data; serialized into `Payload (JSON)`. */
  payload?: Record<string, unknown>
}

interface EventWirePayload {
  eventId: string
  appSessionId: string
  planSessionId: string
  timestamp: string
  eventType: AppEventType
  participantId: string

  route: string
  goalId: string
  missionId: string
  timeSinceAppOpenSec: number
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
  dayOfWeek: number
  hourOfDay: number
  appVersion: string
  backend: MetricBackend
  experimentGroup: Experiment['group']
  persona: Persona
  personaOrder: Experiment['personaOrder']

  goalTitle: string
  goalCategory: string
  goalAdherenceRate: number | null
  currentStreak: number | null
  totalHours: number | null
  missionTitle: string
  missionEstimatedMin: number | null
  missionWasLate: boolean
  milestoneReached: boolean
  notificationTrigger: string
  sheetName: string

  payloadJson: string
}

/* ───────────────────────────── Context ──────────────────────────────── */

/* Things the logger needs to know about every event but which don't
   originate at the event call-site: who the participant is, which app
   session this is, etc. The owning React provider keeps this in sync. */

export interface LoggerContext {
  experiment: Experiment
  persona: Persona
  /** Active planning session id, if currently inside PlanningPage. */
  planSessionId: string
  /** Active goal — passed by hooks but can be overridden per call. */
  currentGoal: Goal | null
}

const APP_VERSION = '0.1.0-prototype'
const ENDPOINT = '/api/metrics'
const FLUSH_DEBOUNCE_MS = 5000
const FLUSH_THRESHOLD = 20
const QUEUE_STORAGE_KEY = 'pacely.metricsQueue.v1'
const MAX_QUEUE_LENGTH = 500

function detectBackend(): MetricBackend {
  return import.meta.env.VITE_USE_LLM === 'true' ? 'openai' : 'mock'
}

function timeOfDay(d: Date): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = d.getHours()
  if (h < 6) return 'night'
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

function nowIsoWithOffset(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const tz = -d.getTimezoneOffset()
  const sign = tz >= 0 ? '+' : '-'
  const tzAbs = Math.abs(tz)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(tzAbs / 60))}:${pad(tzAbs % 60)}`
  )
}

/* ─────────────────────────── Logger singleton ─────────────────────────── */

/* Module-level singleton. We avoid storing the React context state in
   React because event capture must work from anywhere — including
   imperative code paths, beforeunload, and offline-replay timers. */

class EventLogger {
  private appSessionId = uid('app')
  private appOpenAt = Date.now()
  private buffer: EventWirePayload[] = []
  private flushTimer: number | null = null
  private inFlight = false
  private ctx: LoggerContext = {
    experiment: {
      participantId: '',
      group: null,
      personaOrder: null,
      rewardEnabled: true,
    },
    persona: 'gentle',
    planSessionId: '',
    currentGoal: null,
  }
  private route = '/'

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => void this.flushNow())
      window.addEventListener('beforeunload', () => this.flushSync())
      // Visibility/page-hide also wraps mobile background transitions.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flushSync()
      })
    }
  }

  setContext(patch: Partial<LoggerContext>): void {
    this.ctx = { ...this.ctx, ...patch }
  }

  setRoute(pathname: string): void {
    this.route = pathname
  }

  appSession(): string {
    return this.appSessionId
  }

  /** Begin a brand new app session — call this on a fresh mount. */
  resetAppSession(): void {
    this.appSessionId = uid('app')
    this.appOpenAt = Date.now()
  }

  log(input: EventInput): void {
    const wire = this.buildWire(input)
    this.buffer.push(wire)
    if (this.buffer.length >= FLUSH_THRESHOLD) {
      void this.flushNow()
    } else {
      this.scheduleFlush()
    }
  }

  private buildWire(input: EventInput): EventWirePayload {
    const now = new Date()
    const goal = input.goal ?? this.ctx.currentGoal
    const mission = input.mission ?? null
    const exp = this.ctx.experiment

    return {
      eventId: uid('ev'),
      appSessionId: this.appSessionId,
      planSessionId: this.ctx.planSessionId,
      timestamp: nowIsoWithOffset(),
      eventType: input.type,
      participantId: exp.participantId,

      route: this.route,
      goalId: goal?.id ?? '',
      missionId: mission?.id ?? '',
      timeSinceAppOpenSec: Math.round((Date.now() - this.appOpenAt) / 1000),
      timeOfDay: timeOfDay(now),
      dayOfWeek: now.getDay(),
      hourOfDay: now.getHours(),
      appVersion: APP_VERSION,
      backend: detectBackend(),
      experimentGroup: exp.group,
      persona: this.ctx.persona,
      personaOrder: exp.personaOrder,

      goalTitle: goal?.title ?? '',
      goalCategory: goal?.category ?? '',
      goalAdherenceRate: goal?.progress.adherenceRate ?? null,
      currentStreak: goal?.progress.currentStreak ?? null,
      totalHours: goal?.progress.totalHours ?? null,
      missionTitle: mission?.title ?? '',
      missionEstimatedMin: mission?.estimatedMinutes ?? null,
      missionWasLate: input.missionWasLate ?? false,
      milestoneReached: input.milestoneReached ?? false,
      notificationTrigger: input.notificationTrigger ?? '',
      sheetName: input.sheetName ?? '',

      payloadJson: input.payload ? JSON.stringify(input.payload) : '',
    }
  }

  private scheduleFlush(): void {
    if (typeof window === 'undefined') return
    if (this.flushTimer != null) return
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null
      void this.flushNow()
    }, FLUSH_DEBOUNCE_MS)
  }

  /** Best-effort flush; runs in a transaction with the persisted queue. */
  async flushNow(): Promise<void> {
    if (this.inFlight) return
    if (typeof window === 'undefined') return

    // Drain in-memory buffer + any previously-failed rows from storage.
    const queued = this.loadQueue()
    const all = [...queued, ...this.buffer]
    if (all.length === 0) return
    this.buffer = []
    this.saveQueue([])
    this.inFlight = true

    try {
      const resp = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'event', payload: all }),
      })
      if (!resp.ok) {
        // Server-side write failure — re-queue everything for retry.
        this.saveQueue(all)
        const text = await resp.text().catch(() => '')
        console.warn(
          `[eventLogger] ${all.length} events re-queued after HTTP ${resp.status}`,
          text.slice(0, 200),
        )
      }
    } catch (err) {
      // Offline / network error — persist and retry on next online event.
      this.saveQueue(all)
      console.warn('[eventLogger] flush failed; re-queued for retry', err)
    } finally {
      this.inFlight = false
    }
  }

  /** Synchronous best-effort during page unload. Uses sendBeacon when
      available so it survives the navigation. */
  private flushSync(): void {
    if (typeof window === 'undefined') return
    const queued = this.loadQueue()
    const all = [...queued, ...this.buffer]
    if (all.length === 0) return

    const payload = JSON.stringify({ action: 'event', payload: all })

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const sent = navigator.sendBeacon(
        ENDPOINT,
        new Blob([payload], { type: 'application/json' }),
      )
      if (sent) {
        this.buffer = []
        this.saveQueue([])
        return
      }
    }
    // Beacon unavailable or refused — persist for next session's replay.
    this.saveQueue(all)
    this.buffer = []
  }

  private loadQueue(): EventWirePayload[] {
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as EventWirePayload[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  private saveQueue(rows: EventWirePayload[]): void {
    try {
      const trimmed =
        rows.length > MAX_QUEUE_LENGTH ? rows.slice(-MAX_QUEUE_LENGTH) : rows
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(trimmed))
    } catch {
      // storage full / disabled — drop silently rather than crash
    }
  }
}

export const eventLogger = new EventLogger()

/** Convenience function used by hooks/components. */
export function logEvent(input: EventInput): void {
  eventLogger.log(input)
}
