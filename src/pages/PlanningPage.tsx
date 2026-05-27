import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { BackButton } from '../components/BackButton'
import { Button } from '../components/Button'
import { Calendar, rangeDays, rangeIsValid } from '../components/Calendar'
import { ChatBubble } from '../components/ChatBubble'
import { ChatComposer } from '../components/ChatComposer'
import { HourPicker } from '../components/HourPicker'
import { MissionEditSheet } from '../components/MissionEditSheet'
import { PersonaCard } from '../components/PersonaCard'
import { PlanCard } from '../components/PlanCard'
import { PlanDailyStrip } from '../components/PlanDailyStrip'
import { PlanLoading } from '../components/PlanLoading'
import { PlanReviseSheet } from '../components/PlanReviseSheet'
import { createMockAgents, getAgents } from '../lib/agents'
import { generateMissions } from '../lib/store/missions'
import { usePacely } from '../lib/store/store'
import { addDays, todayISO, uid } from '../lib/util'
import type { GoalCategory, MissionTask, Persona, Plan } from '../types'

type Step = 'goal' | 'period' | 'hours' | 'persona' | 'plan'

const ALL_STEPS: Step[] = ['goal', 'period', 'hours', 'persona', 'plan']

const CATEGORY_DEFAULT_TITLE: Record<GoalCategory, string> = {
  exam: '시험 대비',
  project: '프로젝트',
  workout: '운동 루틴',
  diary: '일기 습관',
  custom: '나만의 목표',
}

const CATEGORY_LABEL: Record<GoalCategory, { emoji: string; label: string }> = {
  exam: { emoji: '📚', label: '시험 / 공부' },
  project: { emoji: '🛠️', label: '프로젝트' },
  workout: { emoji: '💪', label: '운동' },
  diary: { emoji: '📓', label: '일기 / 기록' },
  custom: { emoji: '✨', label: '직접 입력' },
}

const SUBJECT_SUGGESTIONS: Record<GoalCategory, string[]> = {
  exam: ['선형대수', '확률통계', '알고리즘', '운영체제', '데이터구조'],
  project: ['리서치', '디자인', '구현', 'QA'],
  workout: [],
  diary: [],
  custom: [],
}

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

interface DraftMissionSheet {
  mode: 'add' | 'edit'
  mission?: MissionTask
  date?: string
}

export function PlanningPage() {
  const navigate = useNavigate()
  const { state, createGoal, setPersona } = usePacely()
  const persona: Persona = state.user.personaPreference

  const [step, setStep] = useState<Step>('goal')
  const [category, setCategory] = useState<GoalCategory | null>(null)
  const [subjects, setSubjects] = useState<string[]>([])
  const [goalText, setGoalText] = useState<string>('')
  const [shortTitle, setShortTitle] = useState<string>('')
  const [pendingText, setPendingText] = useState<string>('')
  const [range, setRange] = useState<{ start?: string; end?: string }>({})
  const [hours, setHours] = useState<number>(3)
  const [chosenPersona, setChosenPersona] = useState<Persona>(persona)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [planLoading, setPlanLoading] = useState(false)

  const [greeting, setGreeting] = useState<string | null>(null)
  const [goalParsing, setGoalParsing] = useState(false)
  const [suggestedDays, setSuggestedDays] = useState<number | null>(null)
  const [suggestedStartDate, setSuggestedStartDate] = useState<string | null>(
    null,
  )
  const [suggestedEndDate, setSuggestedEndDate] = useState<string | null>(null)

  const [draftMissions, setDraftMissions] = useState<MissionTask[]>([])
  const [reviseOpen, setReviseOpen] = useState(false)
  const [missionSheet, setMissionSheet] = useState<DraftMissionSheet | null>(
    null,
  )

  const bodyRef = useRef<HTMLDivElement>(null)
  const stepIndex = ALL_STEPS.indexOf(step)

  useEffect(() => {
    if (step !== 'period') return
    if (range.start) return
    if (suggestedStartDate && suggestedEndDate) {
      setRange({ start: suggestedStartDate, end: suggestedEndDate })
      return
    }
    const days = suggestedDays ?? 14
    const offset = Math.max(0, days - 1)
    setRange({ start: todayISO(), end: addDays(todayISO(), offset) })
  }, [step, range.start, suggestedDays, suggestedStartDate, suggestedEndDate])

  const title = useMemo(() => {
    if (shortTitle) return shortTitle
    if (!category) return 'Pacely와 목표를 정해봐요.'
    return CATEGORY_DEFAULT_TITLE[category]
  }, [shortTitle, category])

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

  const goToNext = () => {
    const i = ALL_STEPS.indexOf(step)
    if (i < 0 || i === ALL_STEPS.length - 1) return
    setStep(ALL_STEPS[i + 1])
  }
  const goToPrev = () => {
    const i = ALL_STEPS.indexOf(step)
    if (i <= 0) return
    if (step === 'plan') {
      setPlan(null)
      setDraftMissions([])
    }
    setStep(ALL_STEPS[i - 1])
  }

  const onSubmitGoal = async () => {
    const text = pendingText.trim()
    if (!text) return
    setGoalText(text)
    setGoalParsing(true)
    try {
      const agent = getAgents().planner
      const result = agent.parseGoal
        ? await agent.parseGoal({ goalText: text, persona: chosenPersona })
        : await createMockAgents().planner.parseGoal!({
            goalText: text,
            persona: chosenPersona,
          })
      setCategory(result.category)
      setShortTitle(result.shortTitle)
      setGreeting(result.greeting)
      setSuggestedDays(result.suggestedDays)
      setSuggestedStartDate(result.suggestedStartDate ?? null)
      setSuggestedEndDate(result.suggestedEndDate ?? null)
      if (
        (result.category === 'exam' || result.category === 'project') &&
        result.suggestedSubjects.length > 0
      ) {
        setSubjects(result.suggestedSubjects)
      } else {
        setSubjects([])
      }
    } catch (err) {
      console.warn('[PlanningPage] parseGoal failed', err)
      setCategory('custom')
      setShortTitle(text.slice(0, 16))
      setGreeting(
        chosenPersona === 'gentle'
          ? '좋은 목표예요. 같이 잘 짜봐요.'
          : '좋습니다. 계획부터 정확히 잡겠습니다.',
      )
      setSuggestedDays(14)
    } finally {
      setGoalParsing(false)
    }
  }

  const onSwitchCategory = (next: GoalCategory) => {
    setCategory(next)
    if (next !== 'exam' && next !== 'project') setSubjects([])
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

  const onApplyRevise = (next: {
    hours: number
    subjects: string[]
    persona: Persona
  }) => {
    setHours(next.hours)
    setSubjects(next.subjects)
    setChosenPersona(next.persona)
    setPlan(null)
    setDraftMissions([])
  }

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
    if (step === 'goal') navigate('/welcome')
    else goToPrev()
  }

  return (
    <div className="page planning-page">
      <header className="planning-header">
        <BackButton onClick={onBack} />
        <div className="planning-progress" aria-hidden>
          {ALL_STEPS.map((s, i) => (
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
        {step === 'goal' && (
          <>
            <ChatBubble from="pacely">
              이번엔 어떤 목표를 이루고 싶으세요?
            </ChatBubble>
            <ChatBubble from="pacely" hideAvatar>
              자유롭게 적어주세요 — 같이 다듬어볼게요.
            </ChatBubble>

            {goalText && (
              <div className="chat-row chat-row--user">
                <div className="chat-bubble chat-bubble--user">{goalText}</div>
              </div>
            )}

            {!goalText && !goalParsing && (
              <ChatComposer
                value={pendingText}
                placeholder="예: 2주 안에 운영체제 시험 준비하기"
                disabled={goalParsing}
                autoFocus
                onChange={setPendingText}
                onSubmit={() => void onSubmitGoal()}
              />
            )}

            {goalParsing && (
              <ChatBubble from="pacely">
                <span className="planning-thinking">
                  Pacely가 정리 중이에요…
                </span>
              </ChatBubble>
            )}

            {!goalParsing && greeting && (
              <>
                <ChatBubble from="pacely">{greeting}</ChatBubble>
                {category && (
                  <div className="category-pill-row">
                    <span className="t-micro">분류</span>
                    {(
                      ['exam', 'project', 'workout', 'diary', 'custom'] as GoalCategory[]
                    ).map((c) => (
                      <button
                        key={c}
                        className={`category-pill ${
                          c === category ? 'category-pill--on' : ''
                        }`}
                        onClick={() => onSwitchCategory(c)}
                      >
                        <span aria-hidden>{CATEGORY_LABEL[c].emoji}</span>
                        <span>{CATEGORY_LABEL[c].label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {greeting && (
              <div className="planning-cta planning-cta--stack">
                <Button block onClick={goToNext}>
                  다음 단계로
                </Button>
                <Button
                  block
                  variant="ghost"
                  disabled={goalParsing}
                  onClick={() => {
                    setGoalText('')
                    setGreeting(null)
                    setShortTitle('')
                    setPendingText(pendingText || goalText)
                  }}
                >
                  다시 적기
                </Button>
              </div>
            )}
          </>
        )}

        {step === 'period' && category && (
          <>
            <ChatBubble from="pacely">
              {suggestedStartDate && suggestedEndDate
                ? `${suggestedStartDate} ~ ${suggestedEndDate} 일정으로 잡아봤어요.`
                : suggestedDays
                  ? `목표를 보니 ${suggestedDays}일 정도면 충분해 보여요.`
                  : '언제부터 언제까지 같이 갈까요?'}
            </ChatBubble>
            <ChatBubble from="pacely" hideAvatar>
              날짜는 자유롭게 바꿔도 돼요. 하루짜리도 가능해요.
            </ChatBubble>
            <Calendar value={range} onChange={setRange} minDate={todayISO()} />
            {rangeIsValid(range) && (
              <ChatBubble from="pacely" hideAvatar>
                {rangeDays(range.start!, range.end!) === 1
                  ? '하루짜리 집중 플랜이네요. 다음으로 가요.'
                  : `${rangeDays(range.start!, range.end!)}일의 여정이에요. 다음으로 가요.`}
              </ChatBubble>
            )}
            <div className="planning-cta">
              <Button block disabled={!rangeIsValid(range)} onClick={goToNext}>
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
                {subjects.length}개로 나누면 한 주제당 약{' '}
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
              <PlanLoading />
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
                  onPickDay={(date) => setMissionSheet({ mode: 'add', date })}
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
