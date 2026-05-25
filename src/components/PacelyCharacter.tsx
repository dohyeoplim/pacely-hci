/* The "grow" avatar for the Co-Reward Grow tab.

   A round Pacely mascot that picks up small accessories per level — eyes,
   sparkles, a band — and recolors based on the user's most-recent goal
   category. Pure SVG so it scales cleanly. */

import { useId } from 'react'

import type { GoalCategory } from '../types'

interface PacelyCharacterProps {
  level: number
  category: GoalCategory
  size?: number
}

const CATEGORY_TONE: Record<GoalCategory, [string, string]> = {
  exam: ['#3a48c0', '#1a2068'],
  project: ['#4a6dd8', '#1a2068'],
  workout: ['#3ddc97', '#1a5a4a'],
  diary: ['#ff7ba8', '#7a2a4c'],
  custom: ['#c084fc', '#4a2068'],
}

export function PacelyCharacter({
  level,
  category,
  size = 144,
}: PacelyCharacterProps) {
  const id = useId()
  const [c1, c2] = CATEGORY_TONE[category]

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <radialGradient id={`${id}-body`} cx="40%" cy="35%" r="80%">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </radialGradient>
        <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Halo at level 3+ */}
      {level >= 3 && (
        <circle
          cx="60"
          cy="60"
          r="56"
          fill="none"
          stroke={c1}
          strokeWidth="1.5"
          opacity="0.4"
        />
      )}

      {/* Body */}
      <circle
        cx="60"
        cy="60"
        r="48"
        fill={`url(#${id}-body)`}
        filter={`url(#${id}-glow)`}
      />

      {/* Pacely symbol — source viewBox is 220×220, scaled to ~50px and
          centered inside the 120×120 mascot box so it reads at a glance. */}
      <g transform="translate(35, 35) scale(0.227)" fill="#fff">
        <path d="M11 22C11 34.1503 20.8497 44 33 44H55H99H121C145.301 44 165 63.6995 165 88C165 112.301 145.301 132 121 132H99C86.8497 132 77 141.85 77 154C77 166.15 86.8497 176 99 176H121C169.601 176 209 136.601 209 88C209 39.3989 169.601 0 121 0H99H55H33C20.8497 0 11 9.84974 11 22Z" />
        <path d="M55 176V132C55 119.85 64.8497 110 77 110H121C133.15 110 143 100.15 143 88C143 75.8497 133.15 66 121 66H55C30.6995 66 11 85.6995 11 110V132V176V198C11 210.15 20.8497 220 33 220C45.1503 220 55 210.15 55 198V176Z" />
      </g>

      {/* Eyes — appear from level 2 */}
      {level >= 2 && (
        <>
          <circle cx="48" cy="50" r="1.6" fill={c2} />
          <circle cx="78" cy="58" r="1.6" fill={c2} />
        </>
      )}

      {/* Sparkles — appear from level 4 */}
      {level >= 4 && (
        <>
          <Sparkle x={20} y={22} color={c1} />
          <Sparkle x={96} y={28} color={c1} />
          <Sparkle x={104} y={90} color={c1} />
        </>
      )}

      {/* Crown at level 5 */}
      {level >= 5 && (
        <path
          d="M44 24 L52 14 L60 22 L68 14 L76 24 L72 32 H48 Z"
          fill="#FFD66E"
          stroke="#1a1300"
          strokeWidth="0.6"
        />
      )}
    </svg>
  )
}

function Sparkle({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path
        d="M0 -6 L1.5 -1.5 L6 0 L1.5 1.5 L0 6 L-1.5 1.5 L-6 0 L-1.5 -1.5 Z"
        fill={color}
      />
    </g>
  )
}
