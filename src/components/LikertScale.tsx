/* 7-point Likert segmented control. Used for both the inline pre-burden
   prompt and items inside BurdenSurveySheet. Tap-only (no slider) keeps
   the affordance unambiguous on touch and avoids the iOS native picker. */

interface LikertScaleProps {
  value: number | null
  onChange: (v: number) => void
  /** Visible anchor labels at the 1 and 7 ends. */
  lowLabel: string
  highLabel: string
  ariaLabel?: string
}

export function LikertScale({
  value,
  onChange,
  lowLabel,
  highLabel,
  ariaLabel,
}: LikertScaleProps) {
  return (
    <div className="likert" role="radiogroup" aria-label={ariaLabel}>
      <div className="likert__row">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            className={`likert__dot ${value === n ? 'likert__dot--on' : ''}`}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="likert__anchors">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  )
}
