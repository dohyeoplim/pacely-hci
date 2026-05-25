/* Co-Planning — chat-driven flow (spec §F1).

   For exam + project goals we slot a "subjects" step between category and
   period, so the generated plan can rotate per-subject missions through each
   day (e.g. 선형대수, 확률통계, 알고리즘). Other categories skip that step. */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { BackButton } from '../components/BackButton'
import { Button } from '../components/Button'
import { Calendar, rangeDays, rangeIsValid } from '../components/Calendar'
import { CATEGORY_ORDER, CategoryCard } from '../components/CategoryCard'
import { ChatBubble } from '../components/ChatBubble'
import { HourPicker } from '../components/HourPicker'
import { PersonaCard } from '../components/PersonaCard'
import { PlanCard } from '../components/PlanCard'
import { PlanDailyStrip } from '../components/PlanDailyStrip'
import { SubjectInput } from '../components/SubjectInput'
import { getAgents } from '../lib/agents'
import { usePacely } from '../lib/store/store'
import { todayISO } from '../lib/util'
import type { GoalCategory, Persona, Plan } from '../types'

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

function deriveTitle(text: string, fallback: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) return fallback
  const cut = trimmed.split(/[,.!?\n]|할거야|하고\s*싶|준비/)[0].trim()
  const base = cut.length > 0 ? cut : trimmed
  const shortened = base.length > 16 ? base.slice(0, 16) + '…' : base
  return shortened.endsWith('하기') ? shortened : `${shortened} 대비하기`
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

  const bodyRef = useRef<HTMLDivElement>(null)
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
        if (!cancelled) setPlan(p)
      })
      .finally(() => {
        if (!cancelled) setPlanLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [step, plan, category, goalText, range, hours, chosenPersona, subjects])

  /* Smooth auto-scroll to the latest chat bubble.

     Step / plan transitions are the obvious triggers, but the chat also grows
     mid-step (calendar pick → "N일의 계획" bubble; subject chips; textarea
     autosize). A ResizeObserver on the body element catches every growth and
     scrolls past it so the next prompt is always in view. */
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return

    const scrollToBottom = () => {
      window.requestAnimationFrame(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth',
        })
      })
    }

    scrollToBottom()
    if (typeof ResizeObserver === 'undefined') return

    let lastHeight = el.getBoundingClientRect().height
    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height
      if (h > lastHeight + 1) scrollToBottom()
      lastHeight = h
    })
    ro.observe(el)
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
    if (step === 'plan') setPlan(null)
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
    })
    navigate('/day-start')
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
              기간을 설정했어요!
            </ChatBubble>
            <Calendar
              value={range}
              onChange={setRange}
              minDate={todayISO()}
            />
            {rangeIsValid(range) && (
              <ChatBubble from="pacely" hideAvatar>
                {rangeDays(range.start!, range.end!)}일의 계획이에요. 다음으로
                넘어가요.
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
              이제 하루 목표를 설정해 주세요.
            </ChatBubble>
            {subjects.length > 0 && (
              <ChatBubble from="pacely" hideAvatar>
                {subjects.length}개로 나누면 한 과목당 약 {' '}
                {Math.round((hours * 60) / subjects.length)}분이에요.
              </ChatBubble>
            )}
            <HourPicker value={hours} onChange={setHours} />
            <div className="planning-cta">
              <Button block onClick={goToNext}>
                시간 설정하기
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
              너무 무리하지 않도록 계획을 세워봤어요!
            </ChatBubble>
            {planLoading || !plan ? (
              <div className="plan-loading t-caption">
                플랜을 그리는 중이에요…
              </div>
            ) : (
              <>
                <PlanCard plan={plan} goalTitle={title} />
                <PlanDailyStrip plan={plan} />
              </>
            )}
            <div className="planning-cta planning-cta--stack">
              <Button block disabled={!plan} onClick={onStartPlan}>
                이 계획으로 시작하기
              </Button>
              <Button
                block
                variant="secondary"
                onClick={() => {
                  setPlan(null)
                  setStep('hours')
                }}
              >
                계획 수정하기
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
