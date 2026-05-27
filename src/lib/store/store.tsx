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
import { eventLogger, logEvent } from '../metrics/eventLogger'
import { todayISO, uid } from '../util'
import type {
  Battle,
  Experiment,
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
import { DEFAULT_EXPERIMENT } from '../experiment'
import { generateMissions } from './missions'
import { loadState, saveState } from './persist'
import { emptyProgress, recomputeProgress } from './progress'
import { initialAvatar, levelUpAvatar, rewardsForGoal } from './rewards'
import { createBattle, resolveBattle, tickBattle } from './battle'

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
  experiment: Experiment
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
  experiment: DEFAULT_EXPERIMENT,
}

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
  | { type: 'SET_EXPERIMENT'; patch: Partial<Experiment> }
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

    case 'SET_EXPERIMENT':
      return {
        ...state,
        experiment: { ...state.experiment, ...action.patch },
      }

    case 'RESET':
      return initialState

    default:
      return state
  }
}

interface PacelyContextValue {
  state: PacelyState
  currentGoal: Goal | null
  setPersona: (persona: Persona) => void
  setName: (name: string) => void
  createGoal: (input: {
    title: string
    category: GoalCategory
    plan: Plan
    missions?: MissionTask[]
  }) => Goal
  installGoal: (goal: Goal) => void
  editGoalTitle: (title: string) => void
  switchGoal: (goalId: string) => void
  abandonGoal: (goalId: string) => void
  toggleMission: (missionId: string) => Promise<void>
  addMission: (input: {
    title: string
    estimatedMinutes: number
    date: string
  }) => void
  editMission: (
    id: string,
    patch: { title?: string; estimatedMinutes?: number; date?: string },
  ) => void
  deleteMission: (id: string) => void
  markNotificationRead: (id: string) => void
  finishGoal: () => void
  redeemReward: (id: string) => void
  startBattle: (stake: string) => Battle | null
  refreshBattles: () => void
  reset: () => void
  recordEvent: (event: Omit<UserEvent, 'at'>) => Promise<void>
  setExperiment: (patch: Partial<Experiment>) => void
}

const PacelyContext = createContext<PacelyContextValue | null>(null)

export function PacelyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, (s) => {
    const persisted = typeof window !== 'undefined' ? loadState() : null
    return persisted
      ? {
          ...s,
          ...persisted,
          rewards: persisted.rewards ?? [],
          avatar: persisted.avatar ?? initialAvatar(),
          battles: persisted.battles ?? [],
          experiment: persisted.experiment ?? DEFAULT_EXPERIMENT,
        }
      : s
  })

  useEffect(() => {
    saveState(state)
  }, [state])

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

  // Live ref so async orchestrator calls never see a stale closure of currentGoal/events.
  const latest = useRef({ currentGoal, events: state.events })
  useEffect(() => {
    latest.current = { currentGoal, events: state.events }
  }, [currentGoal, state.events])

  // Mirror the bits of state the event logger needs. We don't put the
  // logger inside React because event capture must work from imperative
  // code paths (orchestrator callbacks, beforeunload) too.
  useEffect(() => {
    eventLogger.setContext({
      experiment: state.experiment,
      persona: state.user.personaPreference,
      currentGoal,
    })
  }, [state.experiment, state.user.personaPreference, currentGoal])

  // Replay any persisted queue from a previous (offline / killed) session
  // as soon as the provider mounts.
  useEffect(() => {
    void eventLogger.flushNow()
  }, [])

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
          // Notifications arrive as orchestrator output — one event per
          // notification so analytics can break them down by trigger.
          for (const noti of result.notifications) {
            logEvent({
              type: 'notification_received',
              notificationTrigger: noti.trigger,
              goal,
              payload: { notificationId: noti.id, message: noti.message },
            })
          }
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

      // Mirror every UserEvent into the Notion event stream. The existing
      // app already has well-typed coverage of lifecycle moments
      // (app_open, day_started, mission_*, plan_created, goal_finished)
      // so we get most of the value just by piggy-backing on it.
      const goal =
        latest.current.currentGoal && event.goalId
          ? (latest.current.currentGoal.id === event.goalId
              ? latest.current.currentGoal
              : null)
          : latest.current.currentGoal
      const mission = (() => {
        if (!goal || !event.payload) return null
        const mid = event.payload['missionId'] as string | undefined
        if (!mid) return null
        return goal.missions.find((m) => m.id === mid) ?? null
      })()
      logEvent({
        type: event.type,
        goal,
        mission,
        milestoneReached: Boolean(event.payload?.milestoneReached),
        payload: event.payload,
      })

      await runOrchestrator(event, latest.current.currentGoal, latest.current.events)
    },
    [runOrchestrator],
  )

  const value: PacelyContextValue = useMemo(
    () => ({
      state,
      currentGoal,

      setPersona: (persona) => dispatch({ type: 'SET_PERSONA', persona }),
      setName: (name) => dispatch({ type: 'SET_NAME', name }),

      createGoal: ({ title, category, plan, missions }) => {
        const goal: Goal = {
          id: uid('goal'),
          title,
          category,
          startDate: plan.period.startDate,
          endDate: plan.period.endDate,
          plan,
          missions: missions ?? generateMissions(plan, category),
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
        const target = state.goals.find((g) => g.id === goalId) ?? null
        logEvent({
          type: 'goal_switched',
          goal: target,
          payload: { from: currentGoal?.id ?? null, to: goalId },
        })
        dispatch({ type: 'SWITCH_GOAL', goalId })
      },

      abandonGoal: (goalId) => {
        const target = state.goals.find((g) => g.id === goalId) ?? null
        logEvent({ type: 'goal_abandoned', goal: target })
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
            payload: {
              missionId,
              missionTitle: before.title,
              estimatedMinutes: before.estimatedMinutes,
              wasLate: before.date < todayISO(),
              milestoneReached: justFinishedToday,
            },
          })
        } else if (before && before.completed) {
          await recordEvent({
            type: 'mission_uncompleted',
            goalId: currentGoal.id,
            payload: {
              missionId,
              missionTitle: before.title,
              estimatedMinutes: before.estimatedMinutes,
            },
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
        logEvent({ type: 'mission_added', goal: currentGoal, mission })
      },

      editMission: (id, patch) => {
        if (!currentGoal) return
        const before = currentGoal.missions.find((m) => m.id === id) ?? null
        dispatch({
          type: 'EDIT_MISSION',
          goalId: currentGoal.id,
          missionId: id,
          patch,
        })
        logEvent({
          type: 'mission_edited',
          goal: currentGoal,
          mission: before,
          payload: { patch },
        })
      },

      deleteMission: (id) => {
        if (!currentGoal) return
        const before = currentGoal.missions.find((m) => m.id === id) ?? null
        dispatch({
          type: 'DELETE_MISSION',
          goalId: currentGoal.id,
          missionId: id,
        })
        logEvent({ type: 'mission_deleted', goal: currentGoal, mission: before })
      },

      markNotificationRead: (id) => {
        const noti = state.notifications.find((n) => n.id === id)
        if (noti && !noti.read) {
          logEvent({
            type: 'notification_read',
            notificationTrigger: noti.trigger,
            payload: { notificationId: id },
          })
        }
        dispatch({ type: 'MARK_NOTIFICATION_READ', id })
      },

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

      setExperiment: (patch) =>
        dispatch({ type: 'SET_EXPERIMENT', patch }),
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
