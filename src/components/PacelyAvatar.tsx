import { Logo } from './Logo'

interface PacelyAvatarProps {
  size?: number
}

// Symbol fills its viewBox, so render at ~45% of the chip diameter for optical padding.
const MARK_RATIO = 0.45

export function PacelyAvatar({ size = 32 }: PacelyAvatarProps) {
  return (
    <span
      className="pacely-badge"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Logo size={Math.round(size * MARK_RATIO)} />
    </span>
  )
}
