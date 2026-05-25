import { Logo } from './Logo'

interface PacelyAvatarProps {
  size?: number
}

/* The Pacely symbol fills its viewBox edge-to-edge, so we render the mark at
   ~45% of the chip diameter to leave the same optical padding a circular
   monogram would have. */
const MARK_RATIO = 0.45

/** Small Pacely badge used in chat threads and the notification toast. */
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
