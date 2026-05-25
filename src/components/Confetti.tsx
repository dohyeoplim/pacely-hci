/* Lightweight CSS confetti for the Co-Finish celebration. Pure-DOM particles,
   no canvas — keeps the bundle small for a v1 PWA. */

import { useMemo } from 'react'

interface ConfettiProps {
  count?: number
}

const COLORS = ['#FF7BA8', '#4DA6FF', '#C7C9F5', '#3DDC97', '#FFC15E']

export function Confetti({ count = 24 }: ConfettiProps) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 1.6 + Math.random() * 1.2,
        size: 6 + Math.random() * 6,
        color: COLORS[i % COLORS.length],
        rotate: Math.random() * 360,
      })),
    [count],
  )
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti__piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: p.size,
            height: p.size * 0.4,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}
