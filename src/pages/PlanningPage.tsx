/* Co-Planning — chat-driven flow (spec §F1).

   Flow:
     1. category   — pick category card
     2. goal       — type the goal sentence; Pacely responds (LLM) and
                     proposes subjects + day count
     3. subjects   — refine the LLM-suggested subjects/phases (exam/project)
     4. period     — pick dates; pre-filled from suggestedDays
     5. hours      — daily hour budget
     6. persona    — companion vs coach
     7. plan       — show generated plan + missions; editable per-day

   The plan-preview step is the heart of Pacely's HCI value: the AI produces
   a detailed day-by-day breakdown with concrete sub-tasks, then stays
   editable as a conversation. */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { BackButton } from '../components/BackButton'
import { Button } from '../components/Button'
import { Calendar, rangeDays, rangeIsValid } from '../components/Calendar'
import { CATEGORY_ORDER, CategoryCard } from '../components/CategoryCard'
import { ChatBubble } from '../components/ChatBubble'
import { HourPicker } from '../components/HourPicker'
import { MissionEditSheet } from '../components/MissionEditSheet'
import { PersonaCard } from '../components/PersonaCard'
import { PlanCard } from '../components/PlanCard'
import { PlanDailyStrip } from '../components/PlanDailyStrip'
import { PlanReviseSheet } from '../components/PlanReviseSheet'
import { SubjectInput } from '../components/SubjectInput'
import { createMockAgents, getAgents } from '../lib/agents'
import { generateMissions } from '../lib/store/missions'
import { usePacely } from '../lib/store/store'
import { addDays, todayISO, uid } from '../lib/util'
import type { GoalCategory, MissionTask, Persona, Plan } from '../types'

type Step =
  | 'category'
  | 'goal'
  | 'subjects'
  | 'period'
  | 'hours'
  | 'persona'
  | 'plan'

const ALL_STEPS: Step[] = [
  'category',
  'goal',
  'subjects',
  'period',
  'hours',
  'persona',
  'plan',
]

function stepsFor(category: GoalCategory | null): Step[] {
  if (!category) return ['category']
  return ALL_STEPS.filter(
    (s) => s !== 'subjects' || category === 'exam' || category === 'project',
  )
}

const CATEGORY_PROMPT: Record<GoalCategory, string> = {
  exam: '시험을 준비할거야.',
  project: '새 프로젝트를 시작할거야.',
  workout: '꾸준히 운동할거야.',
  diary: '매일 일기를 쓸거야.',
  custom: '',
}

const CATEGORY_DEFAULT_TITLE: Record<GoalCategory, string> = {
  exam: '시험 대비하기',
  project: '새 프로젝트',
  workout: '운동 루틴',
  diary: '일기 습관',
  custom: '나만의 목표',
}

const SUBJECT_SUGGESTIONS: Record<GoalCategory, string[]> = {
  exam: ['선형대수', '확률통계', '알고리즘', '운영체제', '데이터구조'],
  project: ['리서치', '디자인', '구현', 'QA'],
  workout: [],
  diary: [],
  custom: [],
}

/* Companion-tone reactions that play once the plan is generated. */
const PLAN_INTRO_BY_PERSONA: Record<Persona, [string, string, string]> = {
  gentle: [
    '같이 차근차근 짜봤어요.',
    '처음엔 가볍게, 가운데는 본격적으로, 마지막은 부드럽게 마무리하는 흐름이에요.',
    '혼자가 아니에요 — 매일 같은 시간에 옆에 있을게요.',
  ],
  strict: [
    '데이터 기준으로 빈틈없이 짜왔습니다.',
    '하루를 워밍업 → 핵심 작업 → 회고로 끊었어요.',
    '시작 시간을 정해두면 더 잘 따라올 수 있어요.',
  ],
}

function deriveTitle(text: string, fallback: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) return fallback
  const cut = trimmed.split(/[,.!?\n]|할거야|하고\s*싶|준비/)[0].trim()
  const base = cut.length > 0 ? cut : trimmed
  const shortened = base.length > 16 ? base.slice(0, 16) + '…' : base
  return shortened.endsWith('하기') ? shortened : `${shortened} 대비하기`
}

interface DraftMissionSheet {
  mode: 'add' | 'edit'
  mission?: MissionTask
  date?: string
}

interface GoalReaction {
  greeting: string
  followUp?: string
}

export function PlanningPage() {
  const navigate = useNavigate()
  const { state, createGoal, setPersona } = usePacely()
  const persona: Persona = state.user.personaPreference

  const [step, setStep] = useState<Step>('category')
  const [category, setCategory] = useState<GoalCategory | null>(null)
  const [subjects, setSubjects] = useState<string[]>([])
  const [goalText, setGoalText] = useState<string>('')
  const [pendingText, setPendingText] = useState<string>('')
  const [range, setRange] = useState<{ start?: string; end?: string }>({})
  const [hours, setHours] = useState<number>(3)
  const [chosenPersona, setChosenPersona] = useState<Persona>(persona)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [planLoading, setPlanLoading] = useState(false)

  /* Goal-step LLM interaction state. */
  const [goalReaction, setGoalReaction] = useState<GoalReaction | null>(null)
  const [goalParsing, setGoalParsing] = useState(false)
  const [suggestedDays, setSuggestedDays] = useState<number | null>(null)

  /* Draft missions live alongside the plan so the user can edit individual
     sub-tasks before committing. Regenerated whenever a new plan lands. */
  const [draftMissions, setDraftMissions] = useState<MissionTask[]>([])
  const [reviseOpen, setReviseOpen] = useState(false)
  const [missionSheet, setMissionSheet] = useState<DraftMissionSheet | null>(
    null,
  )

  const bodyRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const goalTextareaRef = useRef<HTMLTextAreaElement>(null)
  const steps = useMemo(() => stepsFor(category), [category])
  const stepIndex = steps.indexOf(step)

  /* Grow the goal-input textarea with its content. */
  useEffect(() => {
    const el = goalTextareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [pendingText, step])

  /* When entering the period step, pre-fill the calendar from the LLM's
     suggested day count (falls back to today + 14 if no suggestion).
     Skips if the user has already picked a range. */
  useEffect(() => {
    if (step !== 'period') return
    if (range.start) return
    const days = suggestedDays ?? 14
    const offset = Math.max(0, days - 1)
    setRange({
      start: todayISO(),
      end: addDays(todayISO(), offset),
    })
  }, [step, range.start, suggestedDays])

  const title = useMemo(() => {
    if (!category) return 'Pacely와 목표를 정해봐요.'
    return deriveTitle(goalText, CATEGORY_DEFAULT_TITLE[category])
  }, [category, goalText])

  /* Plan + sub-task generation once we reach the plan step. */
  useEffect(() => {
    if (step !== 'plan' || plan || !category || !range.start || !range.end) return
    let cancelled = false
    setPlanLoading(true)
    const agents = getAgents()

    void (async () => {
      try {
        const p = await agents.planner.decomposeGoal({
          goalText: goalText || CATEGORY_DEFAULT_TITLE[category],
          category,
          startDate: range.start!,
          endDate: range.end!,
          dailyHours: hours,
          persona: chosenPersona,
          subjects: subjects.length > 0 ? subjects : undefined,
        })
        if (cancelled) return
        const planned = { ...p, persona: chosenPersona }

        const missions = agents.planner.generateMissions
          ? await agents.planner.generateMissions(planned, category)
          : generateMissions(planned, category)
        if (cancelled) return

        setPlan(planned)
        setDraftMissions(
          missions.length > 0 ? missions : generateMissions(planned, category),
        )
      } catch (err) {
        if (cancelled) return
        console.warn('[PlanningPage] LLM planner failed, falling back', err)
        const mockAgents = createMockAgents()
        const p = await mockAgents.planner.decomposeGoal({
          goalText: goalText || CATEGORY_DEFAULT_TITLE[category],
          category,
          startDate: range.start!,
          endDate: range.end!,
          dailyHours: hours,
          persona: chosenPersona,
          subjects: subjects.length > 0 ? subjects : undefined,
        })
        if (cancelled) return
        const planned = { ...p, persona: chosenPersona }
        setPlan(planned)
        setDraftMissions(generateMissions(planned, category))
      } finally {
        if (!cancelled) setPlanLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [step, plan, category, goalText, range, hours, chosenPersona, subjects])

  /* Auto-scroll the chat to the latest bubble. */
  useEffect(() => {
    const scrollToBottom = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'end',
          })
        })
      })
    }

    scrollToBottom()

    const body = bodyRef.current
    if (!body || typeof ResizeObserver === 'undefined') return
    let lastHeight = body.getBoundingClientRect().height
    const ro = new ResizeObserver(() => {
      const h = body.getBoundingClientRect().height
      if (h > lastHeight + 1) scrollToBottom()
      lastHeight = h
    })
    ro.observe(body)
    return () => ro.disconnect()
  }, [step, plan, goalReaction])

  const goToNext = () => {
    const i = steps.indexOf(step)
    if (i < 0 || i === steps.length - 1) return
    setStep(steps[i + 1])
  }
  const goToPrev = () => {
    const i = steps.indexOf(step)
    if (i <= 0) return
    if (step === 'plan') {
      setPlan(null)
      setDraftMissions([])
    }
    setStep(steps[i - 1])
  }

  const onCategoryPick = (c: GoalCategory) => {
    setCategory(c)
    setGoalText(CATEGORY_PROMPT[c])
    setPendingText(CATEGORY_PROMPT[c])
    setSubjects([])
    setGoalReaction(null)
    setSuggestedDays(null)
    setStep(stepsFor(c)[1]) // 'goal'
  }

  /* Confirm the goal text and ask Pacely to react. Pacely's response drives
     the subject suggestions + day count pre-fill in later steps. */
  const onConfirmGoal = async () => {
    if (!category) return
    const text = pendingText.trim() || CATEGORY_PROMPT[category]
    setGoalText(text)
    setPendingText(text)

    setGoalParsing(true)
    try {
      const agent = getAgents().planner
      const result = agent.parseGoal
        ? await agent.parseGoal({
            goalText: text,
            category,
            persona: chosenPersona,
          })
        : await createMockAgents().planner.parseGoal!({
            goalText: text,
            category,
            persona: chosenPersona,
          })
      setGoalReaction({ greeting: result.greeting, followUp: result.followUp })
      setSuggestedDays(result.suggestedDays)
      if (
        (category === 'exam' || category === 'project') &&
        result.suggestedSubjects.length > 0
      ) {
        setSubjects(result.suggestedSubjects)
      }
    } catch (err) {
      console.warn('[PlanningPage] parseGoal failed', err)
      setGoalReaction({
        greeting:
          chosenPersona === 'gentle'
            ? '좋은 목표예요. 같이 잘 짜봐요.'
            : '좋습니다. 계획부터 정확히 잡겠습니다.',
      })
      setSuggestedDays(14)
    } finally {
      setGoalParsing(false)
    }
  }

  const onStartPlan = () => {
    if (!plan || !category) return
    setPersona(chosenPersona)
    createGoal({
      title,
      category,
      plan: { ...plan, persona: chosenPersona },
      missions: draftMissions,
    })
    navigate('/day-start')
  }

  /* Open the inline plan revise sheet. */
  const onApplyRevise = (next: {
    hours: number
    subjects: string[]
    persona: Persona
  }) => {
    setHours(next.hours)
    setSubjects(next.subjects)
    setChosenPersona(next.persona)
    setPlan(null) // triggers regeneration
    setDraftMissions([])
  }

  /* Per-day mission editing handlers. */
  const handleSaveMission = (input: {
    id?: string
    title: string
    estimatedMinutes: number
    date: string
  }) => {
    setDraftMissions((prev) => {
      if (input.id) {
        return prev.map((m) =>
          m.id === input.id
            ? {
                ...m,
                title: input.title,
                estimatedMinutes: input.estimatedMinutes,
                date: input.date,
              }
            : m,
        )
      }
      return [
        ...prev,
        {
          id: uid('m'),
          title: input.title,
          estimatedMinutes: input.estimatedMinutes,
          date: input.date,
          completed: false,
        },
      ]
    })
  }
  const handleDeleteMission = (id: string) => {
    setDraftMissions((prev) => prev.filter((m) => m.id !== id))
  }

  const onBack = () => {
    if (step === 'category') navigate('/welcome')
    else goToPrev()
  }

  return (
    <div className="page planning-page">
      <header className="planning-header">
        <BackButton onClick={onBack} />
        <div className="planning-progress" aria-hidden>
          {steps.map((s, i) => (
            <span
              key={s}
              className={`planning-progress__dot ${i <= stepIndex ? 'planning-progress__dot--on' : ''}`}
            />
          ))}
        </div>
        <div className="planning-header__eyebrow">목표 세우기</div>
        <h1 className="planning-header__title">{title}</h1>
      </header>

      <div className="planning-body" ref={bodyRef}>
        {step === 'category' && (
          <>
            <ChatBubble from="pacely">
              이번엔 어떤 목표를 이루고 싶으세요?
            </ChatBubble>
            <div className="category-list">
              {CATEGORY_ORDER.map((c) => (
                <CategoryCard
                  key={c}
                  category={c}
                  onClick={() => onCategoryPick(c)}
                />
              ))}
            </div>
          </>
        )}

        {step === 'goal' && category && (
          <>
            <ChatBubble from="pacely">
              이번엔 어떤 목표를 이루고 싶으세요?
            </ChatBubble>
            <ChatBubble from="pacely" hideAvatar>
              자유롭게 적어주세요 — 같이 다듬어볼게요.
            </ChatBubble>
            <div className="chat-row chat-row--user">
              <textarea
                ref={goalTextareaRef}
                className="goal-input chat-bubble chat-bubble--user"
                value={pendingText}
                placeholder="예: 2주 안에 운영체제 시험 준비하기"
                rows={1}
                autoFocus
                onChange={(e) => setPendingText(e.target.value)}
              />
            </div>

            {goalParsing && (
              <ChatBubble from="pacely">
                <span className="planning-thinking">
                  Pacely가 정리 중이에요…
                </span>
              </ChatBubble>
            )}

            {goalReaction && !goalParsing && (
              <>
                <ChatBubble from="pacely">{goalReaction.greeting}</ChatBubble>
                {goalReaction.followUp && (
                  <ChatBubble from="pacely" hideAvatar>
                    {goalReaction.followUp}
                  </ChatBubble>
                )}
              </>
            )}

            <div className="planning-cta planning-cta--stack">
              {!goalReaction ? (
                <Button
                  block
                  disabled={!pendingText.trim() || goalParsing}
                  onClick={onConfirmGoal}
                >
                  {goalParsing ? '정리 중…' : 'Pacely에게 보여주기'}
                </Button>
              ) : (
                <>
                  <Button block onClick={goToNext}>
                    다음 단계로
                  </Button>
                  <Button
                    block
                    variant="ghost"
                    disabled={goalParsing}
                    onClick={onConfirmGoal}
                  >
                    다시 정리해줘
                  </Button>
                </>
              )}
            </div>
          </>
        )}

        {step === 'subjects' && category && (
          <>
            <ChatBubble from="pacely">
              {category === 'exam'
                ? '어떤 과목들을 다룰까요?'
                : '어떤 단계로 진행해볼까요?'}
            </ChatBubble>
            {subjects.length > 0 && (
              <ChatBubble from="pacely" hideAvatar>
                제가 이렇게 정리해봤어요. 필요하면 바꿔도 좋아요.
              </ChatBubble>
            )}
            <SubjectInput
              value={subjects}
              onChange={setSubjects}
              suggestions={SUBJECT_SUGGESTIONS[category]}
              placeholder={
                category === 'exam'
                  ? '예: 선형대수, 확률통계'
                  : '예: 리서치, 구현, QA'
              }
            />
            <div className="planning-cta planning-cta--stack">
              <Button
                block
                disabled={subjects.length === 0}
                onClick={goToNext}
              >
                {subjects.length}개로 계속하기
              </Button>
              <Button block variant="ghost" onClick={goToNext}>
                건너뛰기
              </Button>
            </div>
          </>
        )}

        {step === 'period' && category && (
          <>
            <ChatBubble from="pacely">
              {suggestedDays
                ? `목표를 보니 ${suggestedDays}일 정도면 충분해 보여요.`
                : '언제부터 언제까지 같이 갈까요?'}
            </ChatBubble>
            <ChatBubble from="pacely" hideAvatar>
              날짜는 자유롭게 바꿔도 돼요. 하루짜리도 가능해요.
            </ChatBubble>
            <Calendar
              value={range}
              onChange={setRange}
              minDate={todayISO()}
            />
            {rangeIsValid(range) && (
              <ChatBubble from="pacely" hideAvatar>
                {rangeDays(range.start!, range.end!) === 1
                  ? '하루짜리 집중 플랜이네요. 다음으로 가요.'
                  : `${rangeDays(range.start!, range.end!)}일의 여정이에요. 다음으로 가요.`}
              </ChatBubble>
            )}
            <div className="planning-cta">
              <Button
                block
                disabled={!rangeIsValid(range)}
                onClick={goToNext}
              >
                다음
              </Button>
            </div>
          </>
        )}

        {step === 'hours' && (
          <>
            <ChatBubble from="pacely">
              하루에 몇 시간 정도 같이 쓸 수 있어요?
            </ChatBubble>
            {subjects.length > 0 && (
              <ChatBubble from="pacely" hideAvatar>
                {subjects.length}개로 나누면 한 주제당 약 {' '}
                {Math.round((hours * 60) / subjects.length)}분이에요.
              </ChatBubble>
            )}
            <HourPicker value={hours} min={1} max={14} onChange={setHours} />
            <div className="planning-cta">
              <Button block onClick={goToNext}>
                {hours}시간으로 가기
              </Button>
            </div>
          </>
        )}

        {step === 'persona' && (
          <>
            <ChatBubble from="pacely">
              어떤 스타일의 Pacely를 원하시나요?
            </ChatBubble>
            <div className="persona-grid">
              <PersonaCard
                persona="gentle"
                active={chosenPersona === 'gentle'}
                onClick={() => setChosenPersona('gentle')}
              />
              <PersonaCard
                persona="strict"
                active={chosenPersona === 'strict'}
                onClick={() => setChosenPersona('strict')}
              />
            </div>
            <div className="planning-cta">
              <Button block onClick={goToNext}>
                계획 만들기
              </Button>
            </div>
          </>
        )}

        {step === 'plan' && (
          <>
            <ChatBubble from="pacely">
              {PLAN_INTRO_BY_PERSONA[chosenPersona][0]}
            </ChatBubble>
            {planLoading || !plan ? (
              <div className="plan-loading t-caption">
                플랜을 그리는 중이에요…
              </div>
            ) : (
              <>
                <ChatBubble from="pacely" hideAvatar>
                  {PLAN_INTRO_BY_PERSONA[chosenPersona][1]}
                </ChatBubble>
                <PlanCard plan={plan} goalTitle={title} />
                <ChatBubble from="pacely" hideAvatar>
                  날짜를 탭하면 그 날 미션을 같이 다듬을 수 있어요.
                </ChatBubble>
                <PlanDailyStrip
                  plan={plan}
                  missions={draftMissions}
                  onPickDay={(date) =>
                    setMissionSheet({ mode: 'add', date })
                  }
                />
                <ChatBubble from="pacely" hideAvatar>
                  {PLAN_INTRO_BY_PERSONA[chosenPersona][2]}
                </ChatBubble>
              </>
            )}
            <div className="planning-cta planning-cta--stack">
              <Button block disabled={!plan} onClick={onStartPlan}>
                이 계획으로 시작하기
              </Button>
              <Button
                block
                variant="secondary"
                disabled={!plan}
                onClick={() => setReviseOpen(true)}
              >
                직접 수정
              </Button>
              <Button
                block
                variant="ghost"
                onClick={() => {
                  setPlan(null)
                  setDraftMissions([])
                  setStep('hours')
                }}
              >
                처음부터 다시
              </Button>
            </div>
          </>
        )}

        <div ref={bottomRef} className="planning-body__sentinel" aria-hidden />
      </div>

      {category && (
        <PlanReviseSheet
          open={reviseOpen}
          category={category}
          initialHours={hours}
          initialSubjects={subjects}
          initialPersona={chosenPersona}
          showSubjects={category === 'exam' || category === 'project'}
          subjectSuggestions={SUBJECT_SUGGESTIONS[category]}
          onClose={() => setReviseOpen(false)}
          onApply={onApplyRevise}
        />
      )}

      {plan && missionSheet && (
        <MissionEditSheet
          open={!!missionSheet}
          mode={missionSheet.mode}
          plan={plan}
          mission={missionSheet.mission}
          defaultDate={missionSheet.date}
          onSave={handleSaveMission}
          onDelete={handleDeleteMission}
          onClose={() => setMissionSheet(null)}
        />
      )}
    </div>
  )
}
