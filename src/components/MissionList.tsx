import type { MissionTask } from '../types'

interface MissionListProps {
  missions: MissionTask[]
  onToggle?: (missionId: string) => void
  onEdit?: (mission: MissionTask) => void
  readOnly?: boolean
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}분`
  if (m === 0) return `${h}시간`
  return `${h}시간 ${m}분`
}

export function MissionList({
  missions,
  onToggle,
  onEdit,
  readOnly = false,
}: MissionListProps) {
  if (!missions.length) {
    return (
      <div className="mission-empty t-caption">오늘의 미션이 없어요.</div>
    )
  }
  return (
    <ul className="mission-list">
      {missions.map((m) => (
        <li key={m.id} className="mission-item">
          <button
            className={`mission-check ${m.completed ? 'mission-check--on' : ''}`}
            onClick={() => !readOnly && onToggle?.(m.id)}
            disabled={readOnly}
            aria-pressed={m.completed}
            aria-label={`${m.title} ${m.completed ? '완료 취소' : '완료'}`}
          >
            {m.completed && (
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden>
                <path
                  d="M1 5 L4.5 8.5 L11 1.5"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          <div className="mission-text">
            <div
              className={`mission-title ${m.completed ? 'mission-title--done' : ''}`}
            >
              {m.title}
            </div>
            <div className="mission-duration t-caption">
              {fmtDuration(m.estimatedMinutes)}
            </div>
          </div>
          {onEdit && (
            <button
              className="mission-more"
              onClick={() => onEdit(m)}
              aria-label="작업 수정"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <circle cx="3" cy="8" r="1.6" />
                <circle cx="8" cy="8" r="1.6" />
                <circle cx="13" cy="8" r="1.6" />
              </svg>
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
