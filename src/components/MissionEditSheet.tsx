import { useEffect, useMemo, useState } from 'react'

import { Button } from './Button'
import { Sheet } from './Sheet'
import type { MissionTask, Plan } from '../types'
import { fromISO } from '../lib/util'

interface MissionEditSheetProps {
  open: boolean
  mode: 'add' | 'edit'
  plan: Plan
  defaultDate?: string
  mission?: MissionTask
  onSave: (input: {
    id?: string
    title: string
    estimatedMinutes: number
    date: string
  }) => void
  onDelete?: (id: string) => void
  onClose: () => void
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const MIN_MIN = 15
const MAX_MIN = 8 * 60
const STEP = 15

export function MissionEditSheet({
  open,
  mode,
  plan,
  defaultDate,
  mission,
  onSave,
  onDelete,
  onClose,
}: MissionEditSheetProps) {
  const [title, setTitle] = useState(mission?.title ?? '')
  const [minutes, setMinutes] = useState(mission?.estimatedMinutes ?? 60)
  const [date, setDate] = useState(
    mission?.date ?? defaultDate ?? plan.dailyAllocation[0]?.date ?? '',
  )

  useEffect(() => {
    if (!open) return
    setTitle(mission?.title ?? '')
    setMinutes(mission?.estimatedMinutes ?? 60)
    setDate(
      mission?.date ?? defaultDate ?? plan.dailyAllocation[0]?.date ?? '',
    )
  }, [open, mission, defaultDate, plan])

  const dateOptions = useMemo(
    () => plan.dailyAllocation.map((d) => d.date),
    [plan],
  )

  const canSave = title.trim().length > 0 && date && minutes > 0
  const step = (delta: number) =>
    setMinutes((m) => Math.max(MIN_MIN, Math.min(MAX_MIN, m + delta)))

  return (
    <Sheet
      open={open}
      onClose={onClose}
      analyticsName={mode === 'add' ? 'mission_add' : 'mission_edit'}
      title={mode === 'add' ? '작업 추가하기' : '작업 수정하기'}
      footer={
        <div className="mission-edit__footer">
          {mode === 'edit' && mission && onDelete && (
            <Button
              variant="ghost"
              onClick={() => {
                onDelete(mission.id)
                onClose()
              }}
            >
              삭제
            </Button>
          )}
          <Button
            block
            disabled={!canSave}
            onClick={() => {
              onSave({
                id: mission?.id,
                title: title.trim(),
                estimatedMinutes: minutes,
                date,
              })
              onClose()
            }}
          >
            저장
          </Button>
        </div>
      }
    >
      <div className="mission-edit">
        <label className="mission-edit__group">
          <span className="t-caption">작업 이름</span>
          <input
            className="profile-input"
            value={title}
            placeholder="예: 선형대수 1회독"
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div className="mission-edit__group">
          <span className="t-caption">소요 시간</span>
          <div className="duration-stepper">
            <button
              className="duration-stepper__btn"
              onClick={() => step(-STEP)}
              disabled={minutes <= MIN_MIN}
            >
              –
            </button>
            <div className="duration-stepper__value">{fmtMinutes(minutes)}</div>
            <button
              className="duration-stepper__btn"
              onClick={() => step(STEP)}
              disabled={minutes >= MAX_MIN}
            >
              +
            </button>
          </div>
          <div className="duration-quick">
            {[30, 60, 90, 120].map((m) => (
              <button
                key={m}
                className={`duration-quick__chip ${minutes === m ? 'duration-quick__chip--on' : ''}`}
                onClick={() => setMinutes(m)}
              >
                {fmtMinutes(m)}
              </button>
            ))}
          </div>
        </div>

        <div className="mission-edit__group">
          <span className="t-caption">날짜</span>
          <div className="date-chips">
            {dateOptions.map((iso) => {
              const d = fromISO(iso)
              return (
                <button
                  key={iso}
                  className={`date-chip ${iso === date ? 'date-chip--on' : ''}`}
                  onClick={() => setDate(iso)}
                >
                  <span className="date-chip__wd">{WEEKDAYS[d.getDay()]}</span>
                  <span className="date-chip__d">{d.getDate()}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Sheet>
  )
}

function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r}분`
  if (r === 0) return `${h}시간`
  return `${h}시간 ${r}분`
}
