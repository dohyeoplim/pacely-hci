import { useState } from 'react'

import { Button } from './Button'
import { LikertScale } from './LikertScale'
import { Sheet } from './Sheet'
import type { SurveyResponse } from '../lib/metrics/types'

/* Post-planning subjective survey.

   Items are grouped to keep cognitive load low:
     1. 부담감 / 자신감 — burden + self-efficacy (Bandura)
     2. 명확도 — plan clarity + immediate actionability (action-readiness)
     3. NASA-TLX — mental / temporal demand, effort, frustration

   Skipping submits null for everything; objective metrics still log.
   This trades methodological purity for participant retention. */

interface BurdenSurveySheetProps {
  open: boolean
  preBurden: number | null
  onSubmit: (response: Omit<SurveyResponse, 'preBurden'>) => void
  onSkip: () => void
}

interface Item {
  key: keyof Omit<SurveyResponse, 'preBurden'>
  question: string
  lowLabel: string
  highLabel: string
}

const ITEMS: Item[] = [
  {
    key: 'postBurden',
    question: '지금, 이 계획을 보니 목표가 얼마나 부담스러운가요?',
    lowLabel: '가볍게',
    highLabel: '매우 무거움',
  },
  {
    key: 'confidence',
    question: '이 계획을 끝까지 해낼 수 있을 것 같나요?',
    lowLabel: '전혀',
    highLabel: '확실히',
  },
  {
    key: 'planClarity',
    question: '계획이 얼마나 분명하게 그려지나요?',
    lowLabel: '흐릿함',
    highLabel: '아주 명확',
  },
  {
    key: 'immediateActionability',
    question: '지금 바로 첫 작업을 시작할 수 있을 것 같나요?',
    lowLabel: '망설여짐',
    highLabel: '바로 시작',
  },
  {
    key: 'nasaTlxMental',
    question: '계획을 따라가는 데 머리가 얼마나 쓰일 것 같나요?',
    lowLabel: '거의 안 씀',
    highLabel: '매우 많이',
  },
  {
    key: 'nasaTlxTemporal',
    question: '주어진 시간 안에 끝낸다는 압박이 얼마나 느껴지나요?',
    lowLabel: '여유로움',
    highLabel: '매우 빡빡',
  },
  {
    key: 'nasaTlxEffort',
    question: '이 계획을 해내려면 얼마나 노력해야 할 것 같나요?',
    lowLabel: '약간',
    highLabel: '아주 많이',
  },
  {
    key: 'nasaTlxFrustration',
    question: '이 계획을 따라가다 막힐 것 같다는 느낌은 어느 정도인가요?',
    lowLabel: '없음',
    highLabel: '많이',
  },
]

const blank = (): Omit<SurveyResponse, 'preBurden'> => ({
  postBurden: null,
  confidence: null,
  planClarity: null,
  immediateActionability: null,
  nasaTlxMental: null,
  nasaTlxTemporal: null,
  nasaTlxEffort: null,
  nasaTlxFrustration: null,
})

export function BurdenSurveySheet({
  open,
  preBurden,
  onSubmit,
  onSkip,
}: BurdenSurveySheetProps) {
  const [values, setValues] = useState<Omit<SurveyResponse, 'preBurden'>>(blank)

  const set =
    (k: keyof Omit<SurveyResponse, 'preBurden'>) =>
    (v: number) =>
      setValues((prev) => ({ ...prev, [k]: v }))

  const answered = Object.values(values).filter((v) => v != null).length
  const allAnswered = answered === ITEMS.length

  return (
    <Sheet
      open={open}
      onClose={onSkip}
      analyticsName="burden_survey"
      title="잠깐, 짧게 체크해볼게요"
      footer={
        <div className="survey__footer">
          <Button variant="ghost" onClick={onSkip}>
            건너뛰기
          </Button>
          <Button
            block
            disabled={!allAnswered}
            onClick={() => {
              onSubmit(values)
            }}
          >
            {allAnswered ? '제출' : `${answered} / ${ITEMS.length}`}
          </Button>
        </div>
      }
    >
      <div className="survey">
        <p className="t-caption survey__lead">
          연구용 짧은 자기평가예요. 답해주시면 더 좋은 계획을 만들 수 있어요.
          {preBurden != null && (
            <>
              {' '}직전에 느낀 부담감은{' '}
              <span className="survey__chip">{preBurden} / 7</span> 이었어요.
            </>
          )}
        </p>

        {ITEMS.map((item) => (
          <section className="survey__item" key={item.key}>
            <div className="survey__q">{item.question}</div>
            <LikertScale
              value={values[item.key]}
              onChange={set(item.key)}
              lowLabel={item.lowLabel}
              highLabel={item.highLabel}
              ariaLabel={item.question}
            />
          </section>
        ))}
      </div>
    </Sheet>
  )
}
