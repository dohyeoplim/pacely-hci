import { useEffect, useMemo, useRef } from 'react'

import { uid } from '../util'
import type { MetricStep } from './types'

/* Session-scoped HCI metric collector.

   Manages timing buckets (per-step dwell, parser/planner latency),
   interaction counters (revisions, mission edits, retries), and a stash
   for the user's pre-burden rating. A single instance lives across one
   plan-creation session; reset() begins a fresh session id. */

interface TimingBuckets {
  // ms enter timestamp per step; null while not on that step
  enterAt: Partial<Record<MetricStep, number>>
  // accumulated ms per step across all visits
  cumulativeMs: Record<MetricStep, number>
  parseStartAt: number | null
  parseEndAt: number | null
  planGenStartAt: number | null
  planGenEndAt: number | null
}

interface InteractionCounts {
  revisionCount: number
  planRegenerationCount: number
  missionAddCount: number
  missionEditCount: number
  missionDeleteCount: number
  retryCount: number
}

export interface MetricSessionSnapshot {
  sessionId: string
  startedAt: number
  endedAt: number
  durationMs: number
  timings: TimingBuckets
  interactions: InteractionCounts
  preBurden: number | null
}

function freshTimings(): TimingBuckets {
  return {
    enterAt: {},
    cumulativeMs: {
      goal: 0,
      period: 0,
      hours: 0,
      persona: 0,
      plan: 0,
    },
    parseStartAt: null,
    parseEndAt: null,
    planGenStartAt: null,
    planGenEndAt: null,
  }
}

function freshInteractions(): InteractionCounts {
  return {
    revisionCount: 0,
    planRegenerationCount: 0,
    missionAddCount: 0,
    missionEditCount: 0,
    missionDeleteCount: 0,
    retryCount: 0,
  }
}

interface MutableSession {
  sessionId: string
  startedAt: number
  timings: TimingBuckets
  interactions: InteractionCounts
  preBurden: number | null
  currentStep: MetricStep | null
}

function newSession(): MutableSession {
  return {
    sessionId: uid('mtr'),
    startedAt: Date.now(),
    timings: freshTimings(),
    interactions: freshInteractions(),
    preBurden: null,
    currentStep: null,
  }
}

export interface MetricCollector {
  /** Replace the live session with a fresh one. */
  reset: () => void
  /** Read the current session ID (stable for the life of the session). */
  sessionId: () => string
  /** Mark that the user entered a step. Closes the previous step's bucket. */
  enterStep: (step: MetricStep) => void
  /** Bracket goal-parser latency. */
  markParseStart: () => void
  markParseEnd: () => void
  /** Bracket planner latency (calls to agents.planner.decomposeGoal). */
  markPlanGenStart: () => void
  markPlanGenEnd: () => void
  /** ++ interaction counters. */
  incRevision: () => void
  incPlanRegeneration: () => void
  incMissionAdd: () => void
  incMissionEdit: () => void
  incMissionDelete: () => void
  incRetry: () => void
  /** Stash pre-burden Likert rating (1–7) from the goal step. */
  setPreBurden: (value: number | null) => void
  /** Read a full snapshot — closes all buckets at the current instant. */
  snapshot: () => MetricSessionSnapshot
}

/* Singleton-per-mount React hook.
   The session is held in a ref so re-renders never reset it, and stays
   stable across component lifecycle (e.g. StrictMode double-invokes). */
export function useMetricCollector(): MetricCollector {
  const ref = useRef<MutableSession | null>(null)
  if (ref.current == null) ref.current = newSession()

  // Always close the open step when the component unmounts so a snapshot
  // taken from outside the React tree still reflects accurate dwell time.
  useEffect(() => {
    return () => {
      const s = ref.current
      if (!s || !s.currentStep) return
      const enterAt = s.timings.enterAt[s.currentStep]
      if (enterAt != null) {
        s.timings.cumulativeMs[s.currentStep] += Date.now() - enterAt
      }
    }
  }, [])

  // useMemo with [] gives us a stable object across renders. All methods
  // close over `ref` (which is itself stable) so they always read latest
  // state without needing fresh closures.
  return useMemo<MetricCollector>(() => {
    const closeOpenStep = (s: MutableSession, now: number) => {
      if (!s.currentStep) return
      const enterAt = s.timings.enterAt[s.currentStep]
      if (enterAt != null) {
        s.timings.cumulativeMs[s.currentStep] += now - enterAt
        s.timings.enterAt[s.currentStep] = undefined
      }
    }

    return {
      reset: () => {
        ref.current = newSession()
      },
      sessionId: () => ref.current!.sessionId,
      enterStep: (step) => {
        const s = ref.current!
        const now = Date.now()
        if (s.currentStep === step && s.timings.enterAt[step] != null) return
        closeOpenStep(s, now)
        s.currentStep = step
        s.timings.enterAt[step] = now
      },
      markParseStart: () => {
        ref.current!.timings.parseStartAt = Date.now()
      },
      markParseEnd: () => {
        ref.current!.timings.parseEndAt = Date.now()
      },
      markPlanGenStart: () => {
        ref.current!.timings.planGenStartAt = Date.now()
      },
      markPlanGenEnd: () => {
        ref.current!.timings.planGenEndAt = Date.now()
      },
      incRevision: () => {
        ref.current!.interactions.revisionCount += 1
      },
      incPlanRegeneration: () => {
        ref.current!.interactions.planRegenerationCount += 1
      },
      incMissionAdd: () => {
        ref.current!.interactions.missionAddCount += 1
      },
      incMissionEdit: () => {
        ref.current!.interactions.missionEditCount += 1
      },
      incMissionDelete: () => {
        ref.current!.interactions.missionDeleteCount += 1
      },
      incRetry: () => {
        ref.current!.interactions.retryCount += 1
      },
      setPreBurden: (v) => {
        ref.current!.preBurden = v
      },
      snapshot: () => {
        const s = ref.current!
        const now = Date.now()
        // Snapshot must not mutate live state — we copy buckets and add the
        // running tail of the open step into the copy.
        const cumulative = { ...s.timings.cumulativeMs }
        if (s.currentStep) {
          const enterAt = s.timings.enterAt[s.currentStep]
          if (enterAt != null) {
            cumulative[s.currentStep] =
              cumulative[s.currentStep] + (now - enterAt)
          }
        }
        return {
          sessionId: s.sessionId,
          startedAt: s.startedAt,
          endedAt: now,
          durationMs: now - s.startedAt,
          timings: {
            enterAt: { ...s.timings.enterAt },
            cumulativeMs: cumulative,
            parseStartAt: s.timings.parseStartAt,
            parseEndAt: s.timings.parseEndAt,
            planGenStartAt: s.timings.planGenStartAt,
            planGenEndAt: s.timings.planGenEndAt,
          },
          interactions: { ...s.interactions },
          preBurden: s.preBurden,
        }
      },
    }
  }, [])
}
