import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { BackButton } from '../components/BackButton'
import { Button } from '../components/Button'
import { SURVEY_URL } from '../lib/experiment'
import {
  ensureNotionEventSchema,
  ensureNotionSchema,
  pingMetrics,
} from '../lib/metrics/client'
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
  const [notionStatus, setNotionStatus] = useState<{
    kind: 'idle' | 'busy' | 'ok' | 'err'
    text: string
  }>({ kind: 'idle', text: '' })

  const commitId = () => {
    const formatted = formatParticipantId(pid)
    setPid(formatted)
    setExperiment({ participantId: formatted })
  }

  const onPing = async () => {
    setNotionStatus({ kind: 'busy', text: 'Notion 환경 확인 중…' })
    const r = await pingMetrics()
    if (!r.ok) {
      const err = 'error' in r.data ? r.data.error : `HTTP ${r.status}`
      setNotionStatus({ kind: 'err', text: `연결 실패: ${err}` })
      return
    }
    const d = r.data as {
      hasToken: boolean
      hasDb: boolean
      hasEventDb: boolean
    }
    if (!d.hasToken || !d.hasDb) {
      setNotionStatus({
        kind: 'err',
        text: 'NOTION_PAT 또는 NOTION_DB_ID가 서버에 설정되어 있지 않아요.',
      })
      return
    }
    setNotionStatus({
      kind: 'ok',
      text: `Notion 환경 OK · 토큰/세션 DB 인식됨${
        d.hasEventDb ? ' · 이벤트 DB 인식됨' : ' · 이벤트 DB 미설정'
      }`,
    })
  }

  const onSync = async () => {
    setNotionStatus({ kind: 'busy', text: '세션 DB 스키마 동기화 중…' })
    const r = await ensureNotionSchema()
    if (!r.ok) {
      const err = 'error' in r.data ? r.data.error : `HTTP ${r.status}`
      setNotionStatus({ kind: 'err', text: `동기화 실패: ${err}` })
      return
    }
    const props = (r.data as { properties: string[] }).properties
    setNotionStatus({
      kind: 'ok',
      text: `세션 DB ${props.length}개 컬럼 동기화 완료.`,
    })
  }

  const onSyncEvents = async () => {
    setNotionStatus({ kind: 'busy', text: '이벤트 DB 스키마 동기화 중…' })
    const r = await ensureNotionEventSchema()
    if (!r.ok) {
      const err = 'error' in r.data ? r.data.error : `HTTP ${r.status}`
      setNotionStatus({ kind: 'err', text: `이벤트 동기화 실패: ${err}` })
      return
    }
    const props = (r.data as { properties: string[] }).properties
    setNotionStatus({
      kind: 'ok',
      text: `이벤트 DB ${props.length}개 컬럼 동기화 완료. 이제 사용 흐름이 실시간 기록돼요.`,
    })
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
        <div className="profile-label t-caption">Notion 자동 기록</div>
        <p className="t-micro">
          계획 1건당 세션 DB에 요약 1행, 사용 흐름은 이벤트 DB에 실시간 기록돼요.
          새 DB라면 먼저 두 스키마 모두 한 번 동기화해주세요.
        </p>
        <div className="research-notion">
          <div className="profile-actions">
            <Button block variant="secondary" onClick={onPing}>
              연결 확인
            </Button>
            <Button block onClick={onSync}>
              세션 DB 동기화
            </Button>
          </div>
          <div className="profile-actions">
            <Button block variant="ghost" onClick={onSyncEvents}>
              이벤트 DB 동기화
            </Button>
          </div>
          <div
            className={`research-notion__status ${
              notionStatus.kind === 'ok'
                ? 'research-notion__status--ok'
                : notionStatus.kind === 'err'
                  ? 'research-notion__status--err'
                  : ''
            }`}
            role="status"
            aria-live="polite"
          >
            {notionStatus.text}
          </div>
        </div>
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
