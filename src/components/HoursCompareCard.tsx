interface HoursCompareCardProps {
  userHours: number
  pacelyHours: number
}

function fmt(h: number): string {
  if (Number.isInteger(h)) return String(h)
  return h.toFixed(1)
}

export function HoursCompareCard({
  userHours,
  pacelyHours,
}: HoursCompareCardProps) {
  const max = Math.max(userHours, pacelyHours, 1)
  return (
    <div className="hours-card">
      <div className="hours-card__title t-caption">오늘의 수행 시간</div>
      <div className="hours-card__cols">
        <Side
          color="var(--you)"
          name="You"
          hours={userHours}
          pctOfMax={userHours / max}
        />
        <Side
          color="var(--pacely)"
          name="Pacely"
          hours={pacelyHours}
          pctOfMax={pacelyHours / max}
        />
      </div>
    </div>
  )
}

function Side({
  color,
  name,
  hours,
  pctOfMax,
}: {
  color: string
  name: string
  hours: number
  pctOfMax: number
}) {
  return (
    <div className="hours-side">
      <div className="hours-side__value" style={{ color }}>
        {fmt(hours)}
        <span className="hours-side__suffix">시간</span>
      </div>
      <div className="hours-side__name">{name}</div>
      <div className="hours-bar">
        <span
          className="hours-bar__fill"
          style={{
            width: `${Math.max(8, pctOfMax * 100)}%`,
            background: color,
          }}
        />
      </div>
    </div>
  )
}
