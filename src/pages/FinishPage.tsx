import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { BackButton } from '../components/BackButton'
import { Button } from '../components/Button'
import { Confetti } from '../components/Confetti'
import { isResearchMode, SURVEY_URL } from '../lib/experiment'
import { usePacely } from '../lib/store/store'
import { daysBetween, formatHours } from '../lib/util'

export function FinishPage() {
  const navigate = useNavigate()
  const { currentGoal, state } = usePacely()
  const [shareHint, setShareHint] = useState<string | null>(null)
  const inStudy = isResearchMode(state.experiment)

  const onShare = async () => {
    if (!currentGoal || !stats) return
    const summary = [
      `Pacely와 함께 ${currentGoal.title} 완주!`,
      `총 기간 ${stats.totalDays}일 · 학습시간 ${formatHours(stats.totalHours)}`,
      `완주율 ${stats.adherence}% · 함께한 날 ${stats.daysWithPacely}일`,
    ].join('\n')
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Pacely 완주 기록', text: summary })
        return
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(summary)
        setShareHint('요약이 클립보드에 복사됐어요')
        setTimeout(() => setShareHint(null), 2400)
        return
      }
      setShareHint('이 기기에서는 공유를 지원하지 않아요')
      setTimeout(() => setShareHint(null), 2400)
    } catch {
      /* user cancelled */
    }
  }

  const stats = useMemo(() => {
    if (!currentGoal) return null
    return {
      totalDays:
        daysBetween(currentGoal.startDate, currentGoal.endDate) + 1,
      totalHours: currentGoal.progress.totalHours,
      adherence: Math.round(currentGoal.progress.adherenceRate * 100),
      daysWithPacely: currentGoal.progress.daysWithPacely,
    }
  }, [currentGoal])

  return (
    <div className="page finish-page">
      <header className="finish-top">
        <BackButton onClick={() => navigate('/home')} />
      </header>

      <Confetti />

      <div className="finish-hero">
        <div className="finish-hero__check" aria-hidden>
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <defs>
              <radialGradient id="finishGlow" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#C7C9F5" />
                <stop offset="100%" stopColor="#7C84E0" />
              </radialGradient>
            </defs>
            <circle cx="40" cy="40" r="36" fill="url(#finishGlow)" />
            <path
              d="M24 41 L36 52 L57 28"
              stroke="#fff"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="finish-hero__title">완주하셨어요!</h1>
        <p className="finish-hero__sub">
          {currentGoal?.plan.weeks ?? 0}주의 긴 여정을 끝까지 이뤄내셨어요.
        </p>
      </div>

      <section className="finish-summary">
        <div className="finish-summary__head">
          <div className="t-caption">완주 요약</div>
          <div className="t-title">Pacely와 함께한 여정</div>
        </div>
        <dl className="finish-summary__list">
          <Row k="목표" v={currentGoal?.title ?? '-'} />
          <Row k="총 기간" v={`${stats?.totalDays ?? 0}일`} />
          <Row k="총 학습시간" v={stats ? formatHours(stats.totalHours) : '-'} />
          <Row k="완주율" v={`${stats?.adherence ?? 0}%`} />
          <Row k="함께한 날" v={`${stats?.daysWithPacely ?? 0}일`} />
        </dl>
      </section>

      {shareHint && <div className="finish-share-hint">{shareHint}</div>}

      {inStudy && (
        <section className="finish-survey">
          <div className="finish-survey__head">
            <span className="finish-survey__tag">실험 참여자 안내</span>
            <div className="t-body-strong">
              경험을 잠깐 들려주실래요?
            </div>
            <p className="t-caption">
              짧은 설문이에요. 결과는 익명으로 분석돼요.
            </p>
          </div>
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

      <div className="finish-cta finish-cta--stack">
        {state.experiment.rewardEnabled && (
          <Button block onClick={() => navigate('/reward')}>
            보상 확인하기
          </Button>
        )}
        <div className="finish-cta-row">
          <Button block variant="secondary" onClick={onShare}>
            공유하기
          </Button>
          <Button block variant="secondary" onClick={() => navigate('/planning')}>
            다음 목표
          </Button>
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="finish-row">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}
