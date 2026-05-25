/* HCI study control panel.

   Researchers enter the participant ID and group conditions here so the
   rest of the app can branch behaviour (LAB1 persona order, LAB2 condition,
   GC reward-off) and so logs can be tied to a participant on export. */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { BackButton } from '../components/BackButton'
import { Button } from '../components/Button'
import { SURVEY_URL } from '../lib/experiment'
import { usePacely } from '../lib/store/store'
import type {
  ExperimentGroup,
  Lab1Order,
  Lab2Condition,
} from '../types'

const GROUPS: { value: ExperimentGroup; label: string; desc: string }[] = [
  { value: 'GA', label: 'GA', desc: '앱 사용 X · 기본 수행률' },
  { value: 'GB', label: 'GB', desc: 'Pacely + reward 모두 ON' },
  { value: 'GC', label: 'GC', desc: 'Pacely 사용, reward OFF' },
]

const LAB1_ORDERS: { value: Lab1Order; label: string }[] = [
  { value: 'companion-first', label: '동반자 → 코치' },
  { value: 'coach-first', label: '코치 → 동반자' },
]

const LAB2_CONDITIONS: { value: Lab2Condition; label: string; desc: string }[] = [
  { value: 'G1', label: 'G1', desc: '종이/메모 자유 방식' },
  { value: 'G2', label: 'G2', desc: '시간대별 빈 템플릿' },
  { value: 'G3', label: 'G3', desc: 'Pacely AI 계획 수립' },
]

export function ResearchPage() {
  const navigate = useNavigate()
  const { state, setExperiment } = usePacely()
  const e = state.experiment
  const [pid, setPid] = useState(e.participantId)

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
          placeholder="예: P01"
          onChange={(ev) => setPid(ev.target.value)}
          onBlur={() => setExperiment({ participantId: pid.trim() })}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') ev.currentTarget.blur()
          }}
        />
        <p className="t-micro">데이터 내보낼 때 이 ID로 익명화돼요.</p>
      </section>

      <section className="research-section">
        <div className="profile-label t-caption">LAB3 그룹</div>
        <div className="research-grid">
          {GROUPS.map((g) => (
            <button
              key={g.value}
              className={`research-chip ${e.group === g.value ? 'research-chip--on' : ''}`}
              onClick={() =>
                setExperiment({
                  group: g.value,
                  rewardEnabled: g.value !== 'GC',
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
        <div className="profile-label t-caption">LAB1 페르소나 체험 순서</div>
        <div className="research-row">
          {LAB1_ORDERS.map((o) => (
            <button
              key={o.value}
              className={`research-pill ${e.lab1Order === o.value ? 'research-pill--on' : ''}`}
              onClick={() => setExperiment({ lab1Order: o.value })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>

      <section className="research-section">
        <div className="profile-label t-caption">LAB2 계획 조건</div>
        <div className="research-grid">
          {LAB2_CONDITIONS.map((c) => (
            <button
              key={c.value}
              className={`research-chip ${e.lab2Condition === c.value ? 'research-chip--on' : ''}`}
              onClick={() => setExperiment({ lab2Condition: c.value })}
            >
              <div className="research-chip__label">{c.label}</div>
              <div className="research-chip__desc">{c.desc}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="research-section">
        <label className="research-toggle">
          <div>
            <div className="t-body-strong">Reward 기능 노출</div>
            <div className="t-caption">
              꺼두면 보상 화면 / 탭 모두 숨겨요 (GC 그룹 자동 OFF).
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
                lab1Order: null,
                lab2Condition: null,
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
