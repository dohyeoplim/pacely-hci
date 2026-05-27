import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { BackButton } from '../components/BackButton'
import { Button } from '../components/Button'
import { SURVEY_URL } from '../lib/experiment'
import { usePacely } from '../lib/store/store'
import type { ExperimentGroup, PersonaOrder } from '../types'

const GROUPS: { value: ExperimentGroup; label: string; desc: string }[] = [
  { value: 'template', label: '템플릿', desc: '시간대 빈 템플릿만 사용' },
  { value: 'pacely', label: 'Pacely', desc: 'Pacely AI 계획 + 동반자' },
]

const PERSONA_ORDERS: { value: PersonaOrder; label: string }[] = [
  { value: 'companion-first', label: '동반자 → 코치' },
  { value: 'coach-first', label: '코치 → 동반자' },
]

function formatParticipantId(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 3)
  if (!digits) return ''
  return `P${digits.padStart(3, '0')}`
}

export function ResearchPage() {
  const navigate = useNavigate()
  const { state, setExperiment } = usePacely()
  const e = state.experiment
  const [pid, setPid] = useState(e.participantId)

  const commitId = () => {
    const formatted = formatParticipantId(pid)
    setPid(formatted)
    setExperiment({ participantId: formatted })
  }

  return (
    <div className="page research-page">
      <header className="research-top">
        <BackButton onClick={() => navigate(-1)} />
      </header>

      <div className="research-intro">
        <h1 className="t-title-lg">리서치 모드</h1>
        <p className="t-caption">
          HCI 실험 운영용 화면이에요. 참가자 정보를 입력하면 그룹 조건에 따라 앱
          UI가 분기돼요.
        </p>
      </div>

      <section className="research-section">
        <label className="profile-label t-caption" htmlFor="pid">
          참가자 ID
        </label>
        <input
          id="pid"
          className="profile-input"
          value={pid}
          placeholder="예: P001"
          inputMode="numeric"
          onChange={(ev) => setPid(ev.target.value)}
          onBlur={commitId}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') ev.currentTarget.blur()
          }}
        />
        <p className="t-micro">세 자리 숫자로 자동 채워져요 (예: 3 → P003).</p>
      </section>

      <section className="research-section">
        <div className="profile-label t-caption">참가 그룹</div>
        <div className="research-row">
          {GROUPS.map((g) => (
            <button
              key={g.value}
              className={`research-chip ${e.group === g.value ? 'research-chip--on' : ''}`}
              onClick={() =>
                setExperiment({
                  group: g.value,
                  rewardEnabled: g.value === 'pacely',
                })
              }
            >
              <div className="research-chip__label">{g.label}</div>
              <div className="research-chip__desc">{g.desc}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="research-section">
        <div className="profile-label t-caption">페르소나 체험 순서</div>
        <div className="research-row">
          {PERSONA_ORDERS.map((o) => (
            <button
              key={o.value}
              className={`research-pill ${e.personaOrder === o.value ? 'research-pill--on' : ''}`}
              onClick={() => setExperiment({ personaOrder: o.value })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>

      <section className="research-section">
        <label className="research-toggle">
          <div>
            <div className="t-body-strong">Reward 기능 노출</div>
            <div className="t-caption">
              꺼두면 보상 화면 / 탭 모두 숨겨요.
            </div>
          </div>
          <input
            type="checkbox"
            checked={e.rewardEnabled}
            onChange={(ev) => setExperiment({ rewardEnabled: ev.target.checked })}
          />
        </label>
      </section>

      <section className="research-section">
        <div className="profile-actions">
          <a
            className="btn btn--secondary btn--block"
            href={SURVEY_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            최종 설문 열기
          </a>
          <Button
            block
            variant="ghost"
            onClick={() => {
              setPid('')
              setExperiment({
                participantId: '',
                group: null,
                personaOrder: null,
                rewardEnabled: true,
              })
            }}
          >
            리서치 설정 초기화
          </Button>
        </div>
      </section>
    </div>
  )
}
