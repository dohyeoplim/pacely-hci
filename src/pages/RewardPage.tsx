/* Co-Reward (spec §F4) — Earn / Grow / Compete.

   Earn:    catalog of partner rewards generated on each goal completion.
   Grow:    Pacely avatar that levels up per finished goal + accumulated traits.
   Compete: start / track a battle against a randomly assigned opponent. */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { BackButton } from '../components/BackButton'
import { Button } from '../components/Button'
import { PacelyCharacter } from '../components/PacelyCharacter'
import { STAKE_PRESETS } from '../lib/store/battle'
import { usePacely } from '../lib/store/store'
import { fromISO } from '../lib/util'
import type { Battle, GoalCategory, Reward } from '../types'

type Tab = 'earn' | 'grow' | 'compete'

export function RewardPage() {
  const navigate = useNavigate()
  const { state, currentGoal, redeemReward, startBattle, refreshBattles } =
    usePacely()
  const [tab, setTab] = useState<Tab>('earn')

  // Re-tick opponent progress whenever the user opens the Compete tab.
  useEffect(() => {
    if (tab === 'compete') refreshBattles()
  }, [tab, refreshBattles])

  return (
    <div className="page reward-page">
      <header className="reward-top">
        <BackButton />
      </header>

      <div className="reward-intro">
        <h1 className="t-title-lg">보상</h1>
        <p className="t-caption">
          완주의 순간이 다음 목표의 동력이 되도록 세 가지 방식으로 돌려드려요.
        </p>
      </div>

      <nav className="reward-tabs" role="tablist">
        <TabBtn label="Earn" active={tab === 'earn'} onClick={() => setTab('earn')} />
        <TabBtn label="Grow" active={tab === 'grow'} onClick={() => setTab('grow')} />
        <TabBtn
          label="Compete"
          active={tab === 'compete'}
          onClick={() => setTab('compete')}
        />
      </nav>

      {tab === 'earn' && (
        <EarnTab rewards={state.rewards} onRedeem={redeemReward} />
      )}
      {tab === 'grow' && (
        <GrowTab
          level={state.avatar.level}
          sessions={state.avatar.accumulatedSessions}
          traits={state.avatar.traits}
          category={state.avatar.themeCategory}
        />
      )}
      {tab === 'compete' && (
        <CompeteTab
          battles={state.battles}
          hasGoal={!!currentGoal}
          onStart={startBattle}
        />
      )}

      <div className="reward-cta reward-cta--stack">
        <Button block onClick={() => navigate('/planning')}>
          새로운 목표 시작하기
        </Button>
        <Button block variant="secondary" onClick={() => navigate('/home')}>
          홈으로
        </Button>
      </div>
    </div>
  )
}

function TabBtn({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      className={`reward-tab ${active ? 'reward-tab--active' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

/* --- Earn tab ------------------------------------------------------------*/

function EarnTab({
  rewards,
  onRedeem,
}: {
  rewards: Reward[]
  onRedeem: (id: string) => void
}) {
  if (rewards.length === 0) {
    return (
      <div className="reward-empty">
        <div className="reward-empty__emoji" aria-hidden>
          🎁
        </div>
        <div className="t-body-strong">아직 받은 리워드가 없어요</div>
        <p className="t-caption">
          첫 목표를 완주하면 카테고리에 맞는 파트너 쿠폰이 도착해요.
        </p>
      </div>
    )
  }
  return (
    <ul className="reward-grid">
      {rewards.map((r) => (
        <RewardItem key={r.id} reward={r} onRedeem={() => onRedeem(r.id)} />
      ))}
    </ul>
  )
}

function RewardItem({
  reward,
  onRedeem,
}: {
  reward: Reward
  onRedeem: () => void
}) {
  const expiry = fromISO(reward.expiryDate)
  const expiryText = `${expiry.getMonth() + 1}.${expiry.getDate()} 까지`
  return (
    <li className={`reward-item ${reward.redeemed ? 'reward-item--redeemed' : ''}`}>
      <div className="reward-item__emoji" aria-hidden>
        {reward.emoji}
      </div>
      <div className="reward-item__body">
        <div className="reward-item__partner">{reward.partnerName}</div>
        <div className="reward-item__title">{reward.title}</div>
        <div className="reward-item__value">{reward.value}</div>
        <div className="reward-item__expiry">{expiryText}</div>
      </div>
      <button
        className="reward-item__redeem"
        onClick={onRedeem}
        disabled={reward.redeemed}
      >
        {reward.redeemed ? '사용 완료' : '사용하기'}
      </button>
    </li>
  )
}

/* --- Grow tab ------------------------------------------------------------*/

/* Pacely levels up one tier per completed goal, capped at Lv. 5. */
const MAX_AVATAR_LEVEL = 5

function GrowTab({
  level,
  sessions,
  traits,
  category,
}: {
  level: number
  sessions: number
  traits: string[]
  category: GoalCategory
}) {
  const atMax = level >= MAX_AVATAR_LEVEL
  return (
    <div className="grow-tab">
      <div className="grow-tab__stage">
        <PacelyCharacter level={level} category={category} size={156} />
      </div>
      <div className="grow-tab__head">
        <div className="grow-tab__level">Lv. {level}</div>
        <div className="t-caption">
          {atMax
            ? `누적 완주 ${sessions}회 · 최고 레벨 달성`
            : `누적 완주 ${sessions}회 · 한 번 더 완주하면 Lv. ${level + 1}`}
        </div>
      </div>
      <div className="grow-traits">
        {traits.length === 0 ? (
          <span className="t-caption">
            첫 목표를 끝내면 Pacely가 첫 trait를 획득해요.
          </span>
        ) : (
          traits.map((t) => (
            <span key={t} className="grow-trait">
              {t}
            </span>
          ))
        )}
      </div>
      <ul className="grow-meaning">
        <li>완주할 때마다 Pacely 캐릭터가 한 단계 자라요.</li>
        <li>매일의 실행이 캐릭터의 분신처럼 쌓여요.</li>
        <li>Pacely의 모습이 곧 당신의 자취가 돼요.</li>
      </ul>
    </div>
  )
}

/* --- Compete tab ---------------------------------------------------------*/

function CompeteTab({
  battles,
  hasGoal,
  onStart,
}: {
  battles: Battle[]
  hasGoal: boolean
  onStart: (stake: string) => Battle | null
}) {
  const [showStarter, setShowStarter] = useState(false)
  const [stake, setStake] = useState(STAKE_PRESETS[0])
  const active = battles.find((b) => b.status === 'active')
  const past = battles.filter((b) => b.status !== 'active')

  if (active) {
    return (
      <div className="battle-card">
        <div className="battle-card__head">
          <span className="battle-tag battle-tag--active">진행 중</span>
          <span className="t-caption">상대 · {active.opponent.name}</span>
        </div>
        <div className="battle-card__title">{active.goalTitle}</div>
        <div className="t-caption">
          내기 · <b>{active.stake}</b>
        </div>
        <BattleBar
          label="You"
          color="var(--you)"
          value={active.userProgress}
        />
        <BattleBar
          label={active.opponent.name}
          color="var(--pacely)"
          value={active.opponent.progress}
        />
        <p className="battle-card__hint t-caption">
          목표를 완주하면 자동으로 결과가 결정돼요.
        </p>
        {past.length > 0 && (
          <div className="battle-history">
            <div className="t-caption">지난 배틀</div>
            <ul>
              {past.slice(0, 4).map((b) => (
                <li key={b.id}>
                  <span>{b.goalTitle}</span>
                  <span
                    className={`battle-tag battle-tag--${b.status}`}
                  >
                    {b.status === 'won' ? '승리' : '패배'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  if (showStarter && hasGoal) {
    return (
      <div className="battle-card">
        <div className="battle-card__head">
          <span className="battle-tag">새 배틀</span>
        </div>
        <div className="battle-card__title">내기를 정해요</div>
        <p className="t-caption">완주에 실패하면 잃고, 이기면 두 배로 받아요.</p>
        <ul className="stake-grid">
          {STAKE_PRESETS.map((s) => (
            <li key={s}>
              <button
                className={`stake-chip ${s === stake ? 'stake-chip--active' : ''}`}
                onClick={() => setStake(s)}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
        <Button
          block
          onClick={() => {
            onStart(stake)
            setShowStarter(false)
          }}
        >
          배틀 시작하기
        </Button>
      </div>
    )
  }

  return (
    <div className="reward-empty">
      <div className="reward-empty__emoji" aria-hidden>
        ⚔️
      </div>
      <div className="t-body-strong">진행 중인 배틀이 없어요</div>
      <p className="t-caption">
        목표를 두고 다른 유저와 경쟁하면 사회적 긴장감이 페이스를 끌어올려요.
      </p>
      <Button
        block
        disabled={!hasGoal}
        onClick={() => setShowStarter(true)}
      >
        {hasGoal ? '배틀 시작하기' : '먼저 목표를 만들어 주세요'}
      </Button>
      {past.length > 0 && (
        <div className="battle-history">
          <div className="t-caption">지난 배틀</div>
          <ul>
            {past.slice(0, 4).map((b) => (
              <li key={b.id}>
                <span>{b.goalTitle}</span>
                <span className={`battle-tag battle-tag--${b.status}`}>
                  {b.status === 'won' ? '승리' : '패배'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function BattleBar({
  label,
  color,
  value,
}: {
  label: string
  color: string
  value: number
}) {
  return (
    <div className="battle-bar">
      <div className="battle-bar__head">
        <span className="t-caption">{label}</span>
        <span className="battle-bar__value" style={{ color }}>
          {Math.round(value * 100)}%
        </span>
      </div>
      <div className="battle-bar__track">
        <span
          className="battle-bar__fill"
          style={{ width: `${value * 100}%`, background: color }}
        />
      </div>
    </div>
  )
}
