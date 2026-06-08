import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { BackButton } from '../components/BackButton'
import type { TriggerCategory } from '../types'

type Level = 'off' | 'min' | 'normal' | 'active'

const LEVELS: { value: Level; label: string; desc: string }[] = [
  {
    value: 'off',
    label: '끔',
    desc: '알림을 받지 않아요. 진행 상황은 직접 확인해요.',
  },
  {
    value: 'min',
    label: '최소',
    desc: '마일스톤·D-day처럼 꼭 필요한 순간에만 알려요.',
  },
  {
    value: 'normal',
    label: '보통',
    desc: '미루기 감지와 응원까지, 균형 있게 챙겨요.',
  },
  {
    value: 'active',
    label: '적극적',
    desc: 'Pacely가 자주 말을 걸며 페이스를 끌어줘요.',
  },
]

const CATEGORIES: { key: TriggerCategory; label: string; desc: string }[] = [
  { key: 'milestone', label: '마일스톤 달성', desc: '목표 구간을 통과할 때 축하해요' },
  { key: 'dday', label: 'D-day 리마인드', desc: '시험·마감이 다가올 때 알려줘요' },
  {
    key: 'procrastination',
    label: '미루기 감지',
    desc: '계획이 밀리고 있으면 콕 집어줘요',
  },
  { key: 'emotion', label: '감정 케어', desc: '지칠 때 Pacely가 다독여줘요' },
  { key: 'social', label: '동반자 메시지', desc: '함께 달리는 응원을 건네요' },
  { key: 'lowburden', label: '가벼운 넛지', desc: '부담 없이 살짝 건네는 한마디' },
  { key: 'stats', label: '진행 리포트', desc: '주간 진행 상황을 요약해줘요' },
]

const DOT_COLOR: Record<TriggerCategory, string> = {
  entry: 'var(--navy-300)',
  milestone: 'var(--success)',
  stats: 'var(--lavender)',
  dday: 'var(--warning)',
  procrastination: 'var(--danger)',
  emotion: 'var(--you)',
  social: 'var(--pacely)',
  lowburden: 'var(--navy-200)',
}

function Switch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`switch ${checked ? 'switch--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch__thumb" aria-hidden />
    </button>
  )
}

export function NotificationSettingsPage() {
  const navigate = useNavigate()
  const [level, setLevel] = useState<Level>('normal')
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CATEGORIES.map((c) => [c.key, true])),
  )
  const [quietHours, setQuietHours] = useState(true)

  const off = level === 'off'
  const current = LEVELS.find((l) => l.value === level) ?? LEVELS[2]

  return (
    <div className="page noti-settings-page">
      <header className="research-top">
        <BackButton onClick={() => navigate(-1)} />
      </header>

      <div className="research-intro">
        <h1 className="t-title-lg">알림 강도</h1>
        <p className="t-caption">
          Pacely가 얼마나 자주, 어떤 일로 말을 걸지 정해요.
        </p>
      </div>

      <section className="research-section">
        <div className="profile-label t-caption">전체 강도</div>
        <div className="noti-level-row">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              className={`noti-level ${level === l.value ? 'noti-level--on' : ''}`}
              aria-pressed={level === l.value}
              onClick={() => setLevel(l.value)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="noti-level__desc t-caption">{current.desc}</p>
      </section>

      <section className="research-section">
        <div className="profile-label t-caption">알림 종류</div>
        <ul className={`noti-cat-list ${off ? 'noti-cat-list--off' : ''}`}>
          {CATEGORIES.map((c) => (
            <li key={c.key} className="noti-cat">
              <span
                className="noti-cat__dot"
                style={{ background: DOT_COLOR[c.key] }}
                aria-hidden
              />
              <span className="noti-cat__body">
                <span className="t-body-strong">{c.label}</span>
                <span className="noti-cat__desc">{c.desc}</span>
              </span>
              <Switch
                label={c.label}
                checked={!off && enabled[c.key]}
                disabled={off}
                onChange={(v) =>
                  setEnabled((prev) => ({ ...prev, [c.key]: v }))
                }
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="research-section">
        <div className="profile-label t-caption">방해 금지</div>
        <div className="noti-quiet">
          <span className="noti-cat__body">
            <span className="t-body-strong">방해 금지 시간</span>
            <span className="noti-cat__desc">
              이 시간엔 알림을 모아뒀다 한꺼번에 전해요
            </span>
          </span>
          <Switch
            label="방해 금지 시간"
            checked={quietHours && !off}
            disabled={off}
            onChange={setQuietHours}
          />
        </div>
        <div
          className={`noti-quiet-range ${
            !quietHours || off ? 'noti-quiet-range--off' : ''
          }`}
        >
          <div className="noti-quiet-range__field">
            <span className="t-micro">시작</span>
            <span className="t-body-strong">23:00</span>
          </div>
          <span className="noti-quiet-range__sep" aria-hidden>
            →
          </span>
          <div className="noti-quiet-range__field">
            <span className="t-micro">종료</span>
            <span className="t-body-strong">08:00</span>
          </div>
        </div>
      </section>

      <p className="noti-settings-foot t-micro">
        설정한 강도는 다음 알림부터 적용돼요.
      </p>
    </div>
  )
}
