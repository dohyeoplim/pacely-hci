/* Co-Planning — chat-driven flow (spec §F1).

   For exam + project goals we slot a "subjects" step between category and
   period, so the generated plan can rotate per-subject missions through each
   day (e.g. 선형대수, 확률통계, 알고리즘). Other categories skip that step.

   The plan-preview step is the heart of Pacely's HCI value prop: the AI
   produces a detailed day-by-day breakdown with concrete sub-tasks, then
   stays editable as a conversation — daily hours, subjects, persona, and
   per-day sub-tasks can all be tweaked without redoing the wizard. */

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
import { getAgents } from '../lib/agents'
import { generateMissions } from '../lib/store/missions'
import { usePacely } from '../lib/store/store'
import { addDays, todayISO, uid } from '../lib/util'
import type { GoalCategory, MissionTask, Persona, Plan } from '../types'

type Step = 'category' | 'subjects' | 'period' | 'hours' | 'persona' | 'plan'

const ALL_STEPS: Step[] = [
  'category',
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

const SUBJECT_PROMPT: Partial<Record<GoalCategory, string>> = {
  exam: '어떤 과목들을 준비하시나요?',
  project: '어떤 단계로 진행하실 거예요?',
}

/* Companion-tone reactions that play once the plan is generated, varied by
   persona so participants in the LAB1 LAB3 conditions get the right feel. */
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

  /* Grow the goal-input textarea with its content instead of locking it at a
     fixed height — feels like a normal chat composer. */
  useEffect(() => {
    const el = goalTextareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [pendingText, step])

  /* Pre-seed the date range so the user lands on a sensible default instead
     of an empty calendar. Anchor at today + 14 days with a small ±3-day
     jitter so demo screenshots and the LAB2-L "2주 프로젝트" framing don't
     feel templated. Skips if the user has already started picking. */
  useEffect(() => {
    if (!category || range.start) return
    const offset = 11 + Math.floor(Math.random() * 7) // 11..17 days inclusive
    setRange({
      start: todayISO(),
      end: addDays(todayISO(), offset),
    })
  }, [category, range.start])

  const title = useMemo(() => {
    if (!category) return 'Pacely와 목표를 정해봐요.'
    return deriveTitle(goalText, CATEGORY_DEFAULT_TITLE[category])
  }, [category, goalText])

  // Generate plan once we reach the plan step.
  useEffect(() => {
    if (step !== 'plan' || plan || !category || !range.start || !range.end) return
    let cancelled = false
    setPlanLoading(true)
    void getAgents()
      .planner.decomposeGoal({
        goalText: goalText || CATEGORY_DEFAULT_TITLE[category],
        category,
        startDate: range.start,
        endDate: range.end,
        dailyHours: hours,
        persona: chosenPersona,
        subjects: subjects.length > 0 ? subjects : undefined,
      })
      .then((p) => {
        if (cancelled) return
        const planned = { ...p, persona: chosenPersona }
        setPlan(planned)
        setDraftMissions(generateMissions(planned, category))
      })
      .finally(() => {
        if (!cancelled) setPlanLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [step, plan, category, goalText, range, hours, chosenPersona, subjects])

  /* Auto-scroll the chat to the latest bubble.

     We anchor on a sentinel <div ref={bottomRef} /> at the very end of the
     planning-body and call scrollIntoView on it. scrollIntoView is more
     reliable than window.scrollTo(scrollHeight) because the browser computes
     the exact target from element layout, so a smooth scroll won't undershoot
     when content keeps growing mid-animation. */
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
  }, [step, plan])

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
    // Pre-seed project defaults so users see them on entry.
    if (c === 'project') setSubjects(['리서치', '디자인', '구현', 'QA'])
    else setSubjects([])
    setStep(stepsFor(c)[1])
  }

  const onConfirmGoalText = () => setGoalText(pendingText)

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

  /* Open the inline plan revise sheet — lets us tune hours / subjects /
     persona without losing the chat context, then regenerates everything. */
  const onApplyRevise = (next: {
    hours: number
    subjects: string[]
    persona: Persona
  }) => {
    setHours(next.hours)
    setSubjects(next.subjects)
    setChosenPersona(next.persona)
    setPlan(null) // triggers the plan-step effect to re-run with new inputs
    setDraftMissions([])
  }

  /* Per-day sub-task editing handlers — the user can refine the AI's
     proposed missions or add their own before committing the plan. */
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

        {step === 'subjects' && category && (
          <>
            <ChatBubble from="pacely">{SUBJECT_PROMPT[category]}</ChatBubble>
            <ChatBubble from="pacely" hideAvatar>
              {category === 'exam'
                ? '과목을 더할수록 하루를 더 잘게 쪼개서 챙겨요.'
                : '단계를 적어두면 매일 그 단계의 작업이 나와요.'}
            </ChatBubble>
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
              이번엔 어떤 목표를 이루고 싶으세요?
            </ChatBubble>
            <div className="chat-row chat-row--user">
              <textarea
                ref={goalTextareaRef}
                className="goal-input chat-bubble chat-bubble--user"
                value={pendingText}
                placeholder="목표를 자유롭게 적어주세요."
                rows={1}
                autoFocus
                onChange={(e) => setPendingText(e.target.value)}
                onBlur={onConfirmGoalText}
              />
            </div>
            <ChatBubble from="pacely" hideAvatar>
              언제부터 언제까지 같이 갈까요? 하루짜리도 좋아요.
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
                onClick={() => {
                  onConfirmGoalText()
                  goToNext()
                }}
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

        {/* Sentinel anchored at the very bottom so scrollIntoView always
            lands past the latest content. */}
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
