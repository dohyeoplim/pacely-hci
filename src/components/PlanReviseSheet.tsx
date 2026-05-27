import { useState } from 'react'

import { Button } from './Button'
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
  onClose: () => void
  onApply: (input: {
    hours: number
    subjects: string[]
    persona: Persona
  }) => void
}

export function PlanReviseSheet({
  open,
  initialHours,
  initialSubjects,
  initialPersona,
  showSubjects,
  subjectSuggestions,
  onClose,
  onApply,
}: PlanReviseSheetProps) {
  const [hours, setHours] = useState(initialHours)
  const [subjects, setSubjects] = useState(initialSubjects)
  const [persona, setPersona] = useState<Persona>(initialPersona)

  return (
    <Sheet
      open={open}
      onClose={onClose}
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
