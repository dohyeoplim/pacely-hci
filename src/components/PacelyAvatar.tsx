import { Logo } from './Logo'

interface PacelyAvatarProps {
  size?: number
}

/** Small Pacely "P" badge used in chat threads and the home header. */
export function PacelyAvatar({ size = 32 }: PacelyAvatarProps) {
  return (
    <span
      className="pacely-badge"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Logo size={size * 0.62} />
    </span>
  )
}
