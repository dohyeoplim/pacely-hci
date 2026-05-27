interface ProgressRingProps {
  /** 0..1 */
  value: number
  label: string
  color: string
  trackColor?: string
  size?: number
}

export function ProgressRing({
  value,
  label,
  color,
  trackColor,
  size = 120,
}: ProgressRingProps) {
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, value))
  const dash = c * pct
  const percentText = Math.round(pct * 100)

  return (
    <div className="ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor ?? 'rgba(255,255,255,0.08)'}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 600ms var(--ease-out)' }}
        />
      </svg>
      <div className="ring__center">
        <div className="ring__pct" style={{ color }}>
          {percentText}%
        </div>
        <div className="ring__label">{label}</div>
      </div>
    </div>
  )
}
