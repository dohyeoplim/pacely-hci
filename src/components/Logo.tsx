/* Geometric "P" monogram used in the splash and the chat avatar.
   Uses an SVG <mask> so the bowl cutout punches through any background
   underneath (gradient, photo, whatever). */

import { useId } from 'react'

interface LogoProps {
  size?: number
  variant?: 'mark' | 'circle'
  color?: string
  className?: string
}

export function Logo({
  size = 64,
  variant = 'mark',
  color = '#FFFFFF',
  className,
}: LogoProps) {
  if (variant === 'circle') {
    return (
      <span
        className={`pacely-avatar ${className ?? ''}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <Mark size={size * 0.55} fill="#FFFFFF" />
      </span>
    )
  }
  return <Mark size={size} fill={color} className={className} />
}

function Mark({
  size,
  fill,
  className,
}: {
  size: number
  fill: string
  className?: string
}) {
  const maskId = useId()
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <defs>
        <mask id={maskId}>
          <rect width="64" height="64" fill="white" />
          <circle cx="34" cy="26" r="6" fill="black" />
        </mask>
      </defs>
      <path
        d="M18 12 H34 a14 14 0 0 1 0 28 H26 V52 H18 Z"
        fill={fill}
        mask={`url(#${maskId})`}
      />
    </svg>
  )
}
