/* Pacely store — single React context, useReducer-backed, persisted to
   localStorage, with an offline sync queue for mission checks (spec §6). */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'

import { getAgents } from '../agents'
import { todayISO, uid } from '../util'
import type {
  Battle,
  Goal,
  GoalCategory,
  MissionTask,
  PacelyAvatar,
  PacelyNotification,
  Persona,
  Plan,
  Reward,
  User,
  UserEvent,
} from '../../types'
import { generateMissions } from './missions'
import { loadState, saveState } from './persist'
import { emptyProgress, recomputeProgress } from './progress'
import { initialAvatar, levelUpAvatar, rewardsForGoal } from './rewards'
import { createBattle, resolveBattle, tickBattle } from './battle'

/* --- State ---------------------------------------------------------------*/

export interface PacelyState {
  user: User
  goals: Goal[]
  currentGoalId: string | null
  notifications: PacelyNotification[]
  events: UserEvent[]
  syncQueue: UserEvent[]
  rewards: Reward[]
  avatar: PacelyAvatar
  battles: Battle[]
}

const DEFAULT_USER: User = {
  id: uid('user'),
  name: '',
  personaPreference: 'gentle',
}

const initialState: PacelyState = {
  user: DEFAULT_USER,
  goals: [],
  currentGoalId: null,
  notifications: [],
  events: [],
  syncQueue: [],
  rewards: [],
  avatar: initialAvatar(),
  battles: [],
}

/* --- Actions -------------------------------------------------------------*/

type Action =
  | { type: 'HYDRATE'; state: PacelyState }
  | { type: 'SET_PERSONA'; persona: Persona }
  | { type: 'SET_NAME'; name: string }
  | { type: 'CREATE_GOAL'; goal: Goal }
  | { type: 'EDIT_GOAL_TITLE'; goalId: string; title: string }
  | { type: 'SWITCH_GOAL'; goalId: string }
  | { type: 'ABANDON_GOAL'; goalId: string }
  | { type: 'TOGGLE_MISSION'; goalId: string; missionId: string }
  | { type: 'ADD_MISSION'; goalId: string; mission: MissionTask }
  | {
      type: 'EDIT_MISSION'
      goalId: string
      missionId: string
      patch: Partial<Pick<MissionTask, 'title' | 'estimatedMinutes' | 'date'>>
    }
  | { type: 'DELETE_MISSION'; goalId: string; missionId: string }
  | { type: 'REPLACE_PLAN'; goalId: string; plan: Plan }
  | { type: 'FINISH_GOAL'; goalId: string }
  | { type: 'ADD_EVENT'; event: UserEvent; offline: boolean }
  | { type: 'FLUSH_QUEUE' }
  | { type: 'ADD_NOTIFICATIONS'; notifications: PacelyNotification[] }
  | { type: 'MARK_NOTIFICATION_READ'; id: string }
  | { type: 'REDEEM_REWARD'; id: string }
  | { type: 'ADD_BATTLE'; battle: Battle }
  | { type: 'UPDATE_BATTLE'; battle: Battle }
  | { type: 'RESET' }

const EVENT_LOG_CAP = 120

function reducer(state: PacelyState, action: Action): PacelyState {
  switch (action.type) {
    case 'HYDRATE':
      return action.state

    case 'SET_PERSONA':
      return {
        ...state,
        user: { ...state.user, personaPreference: action.persona },
      }

    case 'SET_NAME':
      return { ...state, user: { ...state.user, name: action.name } }

    case 'CREATE_GOAL': {
      // Keep existing goals active — user can switch between them.
      return {
        ...state,
        goals: [
          ...state.goals.filter((g) => g.id !== action.goal.id),
          action.goal,
        ],
        currentGoalId: action.goal.id,
      }
    }

    case 'EDIT_GOAL_TITLE': {
      const goals = state.goals.map((g) =>
        g.id !== action.goalId ? g : { ...g, title: action.title },
      )
      return { ...state, goals }
    }

    case 'SWITCH_GOAL':
      return { ...state, currentGoalId: action.goalId }

    case 'ABANDON_GOAL': {
      const goals = state.goals.map((g) =>
        g.id !== action.goalId
          ? g
          : { ...g, status: 'abandoned' as const },
      )
      // If we abandoned the current goal, pick another active one.
      let currentGoalId = state.currentGoalId
      if (currentGoalId === action.goalId) {
        const next = goals.find((g) => g.status === 'active')
        currentGoalId = next?.id ?? null
      }
      return { ...state, goals, currentGoalId }
    }

    case 'TOGGLE_MISSION': {
      const goals = state.goals.map((g) => {
        if (g.id !== action.goalId) return g
        const missions = g.missions.map((m) =>
          m.id !== action.missionId
            ? m
            : {
                ...m,
                completed: !m.completed,
                completedAt: !m.completed ? Date.now() : undefined,
              },
        )
        const next = { ...g, missions }
        return { ...next, progress: recomputeProgress(next) }
      })
      return { ...state, goals }
    }

    case 'ADD_MISSION': {
      const goals = state.goals.map((g) => {
        if (g.id !== action.goalId) return g
        const missions = [...g.missions, action.mission]
        const next = { ...g, missions }
        return { ...next, progress: recomputeProgress(next) }
      })
      return { ...state, goals }
    }

    case 'EDIT_MISSION': {
      const goals = state.goals.map((g) => {
        if (g.id !== action.goalId) return g
        const missions = g.missions.map((m) =>
          m.id !== action.missionId ? m : { ...m, ...action.patch },
        )
        const next = { ...g, missions }
        return { ...next, progress: recomputeProgress(next) }
      })
      return { ...state, goals }
    }

    case 'DELETE_MISSION': {
      const goals = state.goals.map((g) => {
        if (g.id !== action.goalId) return g
        const missions = g.missions.filter((m) => m.id !== action.missionId)
        const next = { ...g, missions }
        return { ...next, progress: recomputeProgress(next) }
      })
      return { ...state, goals }
    }

    case 'REPLACE_PLAN': {
      const goals = state.goals.map((g) =>
        g.id !== action.goalId ? g : { ...g, plan: action.plan },
      )
      return { ...state, goals }
    }

    case 'FINISH_GOAL': {
      const finishedGoal = state.goals.find((g) => g.id === action.goalId)
      const goals = state.goals.map((g) =>
        g.id !== action.goalId ? g : { ...g, status: 'finished' as const },
      )
      // Auto-generate Co-Reward artifacts on completion.
      const newRewards = finishedGoal ? rewardsForGoal(finishedGoal) : []
      const nextAvatar = finishedGoal
        ? levelUpAvatar(state.avatar, finishedGoal)
        : state.avatar
      const resolvedBattles = state.battles.map((b) =>
        b.status === 'active' ? resolveBattle(b, finishedGoal ?? null) : b,
      )
      return {
        ...state,
        goals,
        rewards: [...newRewards, ...state.rewards],
        avatar: nextAvatar,
        battles: resolvedBattles,
      }
    }

    case 'ADD_EVENT': {
      const events = [...state.events, action.event].slice(-EVENT_LOG_CAP)
      const syncQueue = action.offline
        ? [...state.syncQueue, action.event]
        : state.syncQueue
      return { ...state, events, syncQueue }
    }

    case 'FLUSH_QUEUE':
      return { ...state, syncQueue: [] }

    case 'ADD_NOTIFICATIONS':
      return {
        ...state,
        notifications: [...action.notifications, ...state.notifications].slice(0, 30),
      }

    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.id ? { ...n, read: true } : n,
        ),
      }

    case 'REDEEM_REWARD':
      return {
        ...state,
        rewards: state.rewards.map((r) =>
          r.id === action.id ? { ...r, redeemed: true } : r,
        ),
      }

    case 'ADD_BATTLE':
      return { ...state, battles: [action.battle, ...state.battles] }

    case 'UPDATE_BATTLE':
      return {
        ...state,
        battles: state.battles.map((b) =>
          b.id === action.battle.id ? action.battle : b,
        ),
      }

    case 'RESET':
      return initialState

    default:
      return state
  }
}

/* --- Context -------------------------------------------------------------*/

interface PacelyContextValue {
  state: PacelyState
  currentGoal: Goal | null
  /** Update the user's persona preference. */
  setPersona: (persona: Persona) => void
  /** Persist the user's display name. */
  setName: (name: string) => void
  /** Create a goal from a finalized Plan + metadata. */
  createGoal: (input: {
    title: string
    category: GoalCategory
    plan: Plan
  }) => Goal
  /** Install a fully-built goal (used by the demo seed). */
  installGoal: (goal: Goal) => void
  /** Rename the current goal. */
  editGoalTitle: (title: string) => void
  /** Switch the active goal to a different one. */
  switchGoal: (goalId: string) => void
  /** Abandon a goal (won't be auto-resurfaced). */
  abandonGoal: (goalId: string) => void
  /** Toggle a mission's completed flag. Records an event + may trigger notifications. */
  toggleMission: (missionId: string) => Promise<void>
  /** Add a custom mission to the current goal. */
  addMission: (input: {
    title: string
    estimatedMinutes: number
    date: string
  }) => void
  /** Patch an existing mission on the current goal. */
  editMission: (
    id: string,
    patch: { title?: string; estimatedMinutes?: number; date?: string },
  ) => void
  /** Delete a mission on the current goal. */
  deleteMission: (id: string) => void
  /** Mark a notification as read. */
  markNotificationRead: (id: string) => void
  /** Mark the current goal as finished. */
  finishGoal: () => void
  /** Mark a reward as redeemed. */
  redeemReward: (id: string) => void
  /** Start a new compete battle against a randomly assigned opponent. */
  startBattle: (stake: string) => Battle | null
  /** Re-tick the opponent's progress for an active battle (idempotent). */
  refreshBattles: () => void
  /** Wipe everything (debug / "start over"). */
  reset: () => void
  /** Record an arbitrary event (e.g. `app_open`). */
  recordEvent: (event: Omit<UserEvent, 'at'>) => Promise<void>
}

const PacelyContext = createContext<PacelyContextValue | null>(null)

export function PacelyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, (s) => {
    const persisted = typeof window !== 'undefined' ? loadState() : null
    // Backfill in case a previously-persisted state predates rewards/avatar/battles.
    return persisted
      ? {
          ...s,
          ...persisted,
          rewards: persisted.rewards ?? [],
          avatar: persisted.avatar ?? initialAvatar(),
          battles: persisted.battles ?? [],
        }
      : s
  })

  // Persist on every change.
  useEffect(() => {
    saveState(state)
  }, [state])

  // Flush the offline queue when the browser regains connectivity.
  useEffect(() => {
    const handler = () => dispatch({ type: 'FLUSH_QUEUE' })
    window.addEventListener('online', handler)
    return () => window.removeEventListener('online', handler)
  }, [])

  const currentGoal = useMemo(
    () =>
      state.currentGoalId
        ? (state.goals.find((g) => g.id === state.currentGoalId) ?? null)
        : null,
    [state.goals, state.currentGoalId],
  )

  // The orchestrator runs out-of-band so the reducer stays pure.
  const orchestratorBusy = useRef(false)

  const runOrchestrator = useCallback(
    async (event: UserEvent, goal: Goal | null, recentEvents: UserEvent[]) => {
      if (orchestratorBusy.current) return
      orchestratorBusy.current = true
      try {
        const { orchestrator } = getAgents()
        const result = await orchestrator.handleEvent(event, goal, recentEvents)
        if (result.notifications.length) {
          dispatch({
            type: 'ADD_NOTIFICATIONS',
            notifications: result.notifications,
          })
        }
        if (result.replannedPlan && goal) {
          dispatch({
            type: 'REPLACE_PLAN',
            goalId: goal.id,
            plan: result.replannedPlan,
          })
        }
      } finally {
        orchestratorBusy.current = false
      }
    },
    [],
  )

  const recordEvent: PacelyContextValue['recordEvent'] = useCallback(
    async (partial) => {
      const event: UserEvent = { ...partial, at: Date.now() }
      const offline = typeof navigator !== 'undefined' && !navigator.onLine
      dispatch({ type: 'ADD_EVENT', event, offline })
      await runOrchestrator(event, currentGoal, state.events)
    },
    [currentGoal, runOrchestrator, state.events],
  )

  const value: PacelyContextValue = useMemo(
    () => ({
      state,
      currentGoal,

      setPersona: (persona) => dispatch({ type: 'SET_PERSONA', persona }),
      setName: (name) => dispatch({ type: 'SET_NAME', name }),

      createGoal: ({ title, category, plan }) => {
        const goal: Goal = {
          id: uid('goal'),
          title,
          category,
          startDate: plan.period.startDate,
          endDate: plan.period.endDate,
          plan,
          missions: generateMissions(plan, category),
          progress: emptyProgress(),
          status: 'active',
          createdAt: Date.now(),
        }
        dispatch({ type: 'CREATE_GOAL', goal })
        void recordEvent({ type: 'plan_created', goalId: goal.id })
        return goal
      },

      installGoal: (goal) => {
        dispatch({ type: 'CREATE_GOAL', goal })
      },

      editGoalTitle: (title) => {
        if (!currentGoal) return
        dispatch({ type: 'EDIT_GOAL_TITLE', goalId: currentGoal.id, title })
      },

      switchGoal: (goalId) => {
        dispatch({ type: 'SWITCH_GOAL', goalId })
      },

      abandonGoal: (goalId) => {
        dispatch({ type: 'ABANDON_GOAL', goalId })
      },

      toggleMission: async (missionId) => {
        if (!currentGoal) return
        const before = currentGoal.missions.find((m) => m.id === missionId)
        dispatch({
          type: 'TOGGLE_MISSION',
          goalId: currentGoal.id,
          missionId,
        })
        if (before && !before.completed) {
          // Subtle haptic — supported on Android / some PWAs; ignored elsewhere.
          if (
            typeof navigator !== 'undefined' &&
            typeof navigator.vibrate === 'function'
          ) {
            navigator.vibrate(18)
          }
          const todayMissions = currentGoal.missions.filter(
            (m) => m.date === todayISO(),
          )
          const justFinishedToday =
            todayMissions.length > 0 &&
            todayMissions.every((m) => m.completed || m.id === missionId)
          await recordEvent({
            type: 'mission_completed',
            goalId: currentGoal.id,
            payload: { milestoneReached: justFinishedToday },
          })
        }
      },

      addMission: (input) => {
        if (!currentGoal) return
        const mission: MissionTask = {
          id: uid('m'),
          title: input.title,
          estimatedMinutes: input.estimatedMinutes,
          date: input.date,
          completed: false,
        }
        dispatch({ type: 'ADD_MISSION', goalId: currentGoal.id, mission })
      },

      editMission: (id, patch) => {
        if (!currentGoal) return
        dispatch({
          type: 'EDIT_MISSION',
          goalId: currentGoal.id,
          missionId: id,
          patch,
        })
      },

      deleteMission: (id) => {
        if (!currentGoal) return
        dispatch({
          type: 'DELETE_MISSION',
          goalId: currentGoal.id,
          missionId: id,
        })
      },

      markNotificationRead: (id) =>
        dispatch({ type: 'MARK_NOTIFICATION_READ', id }),

      finishGoal: () => {
        if (!currentGoal) return
        dispatch({ type: 'FINISH_GOAL', goalId: currentGoal.id })
        void recordEvent({ type: 'goal_finished', goalId: currentGoal.id })
      },

      redeemReward: (id) => dispatch({ type: 'REDEEM_REWARD', id }),

      startBattle: (stake) => {
        if (!currentGoal) return null
        const b = createBattle(currentGoal.title, stake)
        dispatch({ type: 'ADD_BATTLE', battle: b })
        return b
      },

      refreshBattles: () => {
        const now = Date.now()
        state.battles.forEach((b) => {
          if (b.status !== 'active') return
          const next = tickBattle(b, now)
          if (next.opponent.progress !== b.opponent.progress) {
            dispatch({ type: 'UPDATE_BATTLE', battle: next })
          }
        })
      },

      reset: () => dispatch({ type: 'RESET' }),

      recordEvent,
    }),
    [state, currentGoal, recordEvent],
  )

  return <PacelyContext.Provider value={value}>{children}</PacelyContext.Provider>
}

export function usePacely(): PacelyContextValue {
  const ctx = useContext(PacelyContext)
  if (!ctx) throw new Error('usePacely must be used within <PacelyProvider>')
  return ctx
}
