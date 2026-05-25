/* Profile — change persona, edit display name, switch between active goals,
   view history, finish or reset. */

import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { Button } from '../components/Button'
import { PersonaCard } from '../components/PersonaCard'
import { isResearchMode, SURVEY_URL } from '../lib/experiment'
import { usePacely } from '../lib/store/store'

export function ProfilePage() {
  const navigate = useNavigate()
  const {
    currentGoal,
    state,
    setPersona,
    setName,
    switchGoal,
    finishGoal,
    abandonGoal,
    reset,
  } = usePacely()
  const [draftName, setDraftName] = useState(state.user.name)

  useEffect(() => {
    setDraftName(state.user.name)
  }, [state.user.name])

  if (!currentGoal) return <Navigate to="/welcome" replace />

  const activeGoals = state.goals.filter((g) => g.status === 'active')
  const otherActiveGoals = activeGoals.filter((g) => g.id !== currentGoal.id)
  const hasHistory = state.goals.some((g) => g.status !== 'active')
  const inStudy = isResearchMode(state.experiment)

  return (
    <div className="page profile-page">
      <header className="record-head">
        <h1 className="t-title-lg">프로필</h1>
        <p className="t-caption">Pacely와의 관계를 설정해요.</p>
      </header>

      <section className="profile-section">
        <label className="profile-label t-caption" htmlFor="name">
          이름
        </label>
        <input
          id="name"
          className="profile-input"
          value={draftName}
          placeholder="당신의 이름"
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={() => setName(draftName.trim())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
      </section>

      <section className="profile-section">
        <div className="profile-label t-caption">Pacely 스타일</div>
        <div className="persona-grid">
          <PersonaCard
            persona="gentle"
            active={state.user.personaPreference === 'gentle'}
            onClick={() => setPersona('gentle')}
          />
          <PersonaCard
            persona="strict"
            active={state.user.personaPreference === 'strict'}
            onClick={() => setPersona('strict')}
          />
        </div>
      </section>

      <section className="profile-section">
        <div className="profile-label t-caption">현재 목표</div>
        <div className="profile-goal">
          <div className="t-body-strong">{currentGoal.title}</div>
          <div className="t-caption">
            {currentGoal.plan.weeks}주 · 하루{' '}
            {currentGoal.plan.dailyAllocation[0]?.hours ?? 0}시간
          </div>
        </div>
        <div className="profile-actions">
          <Button
            block
            variant="secondary"
            onClick={() => {
              finishGoal()
              navigate('/finish')
            }}
          >
            이 목표 완주 처리
          </Button>
          <Button
            block
            variant="ghost"
            onClick={() => {
              if (confirm('이 목표를 중단할까요? (완주율은 그대로 남아요)')) {
                abandonGoal(currentGoal.id)
                if (otherActiveGoals.length === 0) navigate('/welcome')
              }
            }}
          >
            이 목표 중단하기
          </Button>
        </div>
      </section>

      {otherActiveGoals.length > 0 && (
        <section className="profile-section">
          <div className="profile-label t-caption">다른 진행 중 목표</div>
          <ul className="goal-switch-list">
            {otherActiveGoals.map((g) => (
              <li key={g.id}>
                <button
                  className="goal-switch"
                  onClick={() => {
                    switchGoal(g.id)
                    navigate('/home')
                  }}
                >
                  <div className="goal-switch__body">
                    <div className="t-body-strong">{g.title}</div>
                    <div className="t-caption">
                      완료율 {Math.round(g.progress.adherenceRate * 100)}%
                    </div>
                  </div>
                  <span className="goal-switch__arrow" aria-hidden>
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="profile-section">
        <div className="profile-actions">
          <Link to="/planning" className="btn btn--secondary btn--block">
            새 목표 추가하기
          </Link>
          {hasHistory && (
            <Link to="/history" className="btn btn--ghost btn--block">
              지난 목표 보기
            </Link>
          )}
          <Button
            block
            variant="ghost"
            onClick={() => {
              if (confirm('모든 데이터를 지울까요?')) {
                reset()
                navigate('/welcome')
              }
            }}
          >
            처음부터 다시
          </Button>
        </div>
      </section>

      {inStudy && (
        <section className="profile-section profile-survey">
          <div className="t-body-strong">실험 참여 마지막 단계</div>
          <p className="t-caption">
            앱 사용 경험을 마무리하셨다면 짧은 설문 부탁드려요.
          </p>
          <a
            className="btn btn--primary btn--block"
            href={SURVEY_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            최종 설문 작성하기 →
          </a>
        </section>
      )}

      <section className="profile-section profile-research">
        <Link to="/research" className="profile-research-link">
          <span>리서치 모드</span>
          <span className="profile-research-link__arrow" aria-hidden>→</span>
        </Link>
        <p className="t-micro">HCI 실험 운영자용</p>
      </section>
    </div>
  )
}
