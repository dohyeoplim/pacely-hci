interface DDayBadgeProps {
  days: number
  variant?: 'pill' | 'inline'
}

export function DDayBadge({ days, variant = 'pill' }: DDayBadgeProps) {
  const text =
    days > 0 ? `D-${days}` : days === 0 ? 'D-day' : `D+${Math.abs(days)}`
  return (
    <span className={`dday-badge ${variant === 'inline' ? 'dday-badge--inline' : ''}`}>
      {text}
    </span>
  )
}
