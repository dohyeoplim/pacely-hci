import { useMemo } from 'react'

import { Button } from './Button'
import { Sheet } from './Sheet'
import type { DailyAllocation, MissionTask } from '../types'
import { fromISO } from '../lib/util'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

interface DayMissionsSheetProps {
  open: boolean
  date: string | null
  allocation?: DailyAllocation
  missions: MissionTask[]
  onAdd: () => void
  onEdit: (mission: MissionTask) => void
  onDelete?: (id: string) => void
  onClose: () => void
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}분`
  if (m === 0) return `${h}시간`
  return `${h}시간 ${m}분`
}

export function DayMissionsSheet({
  open,
  date,
  allocation,
  missions,
  onAdd,
  onEdit,
  onDelete,
  onClose,
}: DayMissionsSheetProps) {
  const header = useMemo(() => {
    if (!date) return null
    const d = fromISO(date)
    return `${d.getMonth() + 1}월 ${d.getDate()}일 · ${WEEKDAYS[d.getDay()]}요일`
  }, [date])

  const totalMin = missions.reduce((s, m) => s + m.estimatedMinutes, 0)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      analyticsName="day_missions"
      title={header ?? '하루 작업'}
      footer={
        <div className="mission-edit__footer">
          <Button block onClick={onAdd}>
            + 작업 추가
          </Button>
        </div>
      }
    >
      <div className="day-missions">
        <div className="day-missions__meta t-caption">
          {allocation ? `${allocation.hours}h 계획 · ` : ''}
          {missions.length}개 작업 · {fmtDuration(totalMin)}
        </div>

        {allocation?.summary && (
          <div className="day-missions__summary">{allocation.summary}</div>
        )}

        {missions.length === 0 ? (
          <div className="mission-empty t-caption">
            아직 이 날에 등록된 작업이 없어요. 아래에서 추가해보세요.
          </div>
        ) : (
          <ul className="day-missions__list">
            {missions.map((m) => (
              <li key={m.id} className="day-missions__item">
                <button
                  type="button"
                  className="day-missions__item-main"
                  onClick={() => onEdit(m)}
                  aria-label={`${m.title} 수정`}
                >
                  <div className="day-missions__item-title">{m.title}</div>
                  <div className="day-missions__item-sub t-caption">
                    {fmtDuration(m.estimatedMinutes)}
                  </div>
                </button>
                {onDelete && (
                  <button
                    type="button"
                    className="day-missions__item-del"
                    onClick={() => onDelete(m.id)}
                    aria-label={`${m.title} 삭제`}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M3 3 L11 11 M11 3 L3 11"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  )
}
