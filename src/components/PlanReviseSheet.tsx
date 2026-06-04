import { useState } from 'react'

import { Button } from './Button'
import { ChatComposer } from './ChatComposer'
import { HourPicker } from './HourPicker'
import { PersonaCard } from './PersonaCard'
import { Sheet } from './Sheet'
import { SubjectInput } from './SubjectInput'
import type { GoalCategory, Persona } from '../types'

interface PlanReviseSheetProps {
  open: boolean
  category: GoalCategory
  initialHours: number
  initialSubjects: string[]
  initialPersona: Persona
  showSubjects: boolean
  subjectSuggestions: string[]
  /** True while a free-text revision request is being processed by Pacely. */
  revising?: boolean
  onClose: () => void
  onApply: (input: {
    hours: number
    subjects: string[]
    persona: Persona
  }) => void
  /** Send a conversational revision request to Pacely. When omitted the chat
      box is hidden. */
  onRevisePrompt?: (instruction: string) => void
}

const REVISE_EXAMPLES = [
  '마지막 주는 기출 문제 위주로 바꿔줘',
  '개념 학습 기간을 더 길게',
  '주말은 가볍게 복습만',
]

export function PlanReviseSheet({
  open,
  initialHours,
  initialSubjects,
  initialPersona,
  showSubjects,
  subjectSuggestions,
  revising = false,
  onClose,
  onApply,
  onRevisePrompt,
}: PlanReviseSheetProps) {
  const [hours, setHours] = useState(initialHours)
  const [subjects, setSubjects] = useState(initialSubjects)
  const [persona, setPersona] = useState<Persona>(initialPersona)
  const [prompt, setPrompt] = useState('')

  const submitPrompt = () => {
    const text = prompt.trim()
    if (!text || !onRevisePrompt) return
    onRevisePrompt(text)
    setPrompt('')
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      analyticsName="plan_revise"
      title="같이 다시 잡아볼까요?"
      footer={
        <div className="plan-revise__footer">
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button
            block
            onClick={() => {
              onApply({ hours, subjects, persona })
              onClose()
            }}
          >
            계획 다시 만들기
          </Button>
        </div>
      }
    >
      <div className="plan-revise">
        {onRevisePrompt && (
          <section className="plan-revise__group plan-revise__chat">
            <div className="t-caption">Pacely에게 수정 요청</div>
            <p className="t-micro plan-revise__hint">
              말로 바꿔보세요. 기간·하루 시간은 그대로 두고 흐름만 다시 짜요.
            </p>
            <ChatComposer
              value={prompt}
              placeholder="예: 마지막 주는 문제 풀이 위주로 바꿔줘"
              disabled={revising}
              sendLabel="수정 요청"
              onChange={setPrompt}
              onSubmit={submitPrompt}
            />
            {revising ? (
              <div className="plan-revise__thinking t-micro">
                Pacely가 계획을 다시 짜는 중이에요…
              </div>
            ) : (
              <div className="plan-revise__chips">
                {REVISE_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    className="plan-revise__chip"
                    onClick={() => setPrompt(ex)}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="plan-revise__group">
          <div className="t-caption">하루 시간</div>
          <HourPicker value={hours} min={1} max={14} onChange={setHours} />
        </section>

        {showSubjects && (
          <section className="plan-revise__group">
            <div className="t-caption">집중할 주제</div>
            <SubjectInput
              value={subjects}
              onChange={setSubjects}
              suggestions={subjectSuggestions}
            />
          </section>
        )}

        <section className="plan-revise__group">
          <div className="t-caption">Pacely 스타일</div>
          <div className="persona-grid">
            <PersonaCard
              persona="gentle"
              active={persona === 'gentle'}
              onClick={() => setPersona('gentle')}
            />
            <PersonaCard
              persona="strict"
              active={persona === 'strict'}
              onClick={() => setPersona('strict')}
            />
          </div>
        </section>
      </div>
    </Sheet>
  )
}
