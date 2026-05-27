import { LikertScale } from './LikertScale'

/* Inline pre-planning burden capture. Shown in the goal step right after
   the bot greeting, before the user advances to the period step.
   Optional — if the user just taps "다음 단계로" without rating, the
   value stays null and the post-survey infers "burden change" from post
   alone. Capturing pre concurrently (rather than retrospectively) keeps
   this measure methodologically valid. */

interface PreBurdenPromptProps {
  value: number | null
  onChange: (v: number) => void
}

export function PreBurdenPrompt({ value, onChange }: PreBurdenPromptProps) {
  return (
    <div className="pre-burden">
      <div className="pre-burden__q">
        지금 이 목표가 얼마나 무겁게 느껴지나요?
      </div>
      <LikertScale
        value={value}
        onChange={onChange}
        lowLabel="가볍게"
        highLabel="매우 무거움"
        ariaLabel="목표 부담감"
      />
    </div>
  )
}
