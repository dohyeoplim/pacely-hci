/* Pacely brand mark.

   Renders the canonical "P-loop" symbol from public/pacely_logo_symbol.svg so
   in-app branding matches the installed app icon. Two variants:
     - mark:   raw symbol on transparent background (color overrides via fill)
     - circle: symbol centered inside the navy gradient badge (used for chat
               avatars and home header)
*/

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
        <Mark size={Math.round(size * 0.56)} fill="#FFFFFF" />
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
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 220 220"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <path
        d="M11 22C11 34.1503 20.8497 44 33 44H55H99H121C145.301 44 165 63.6995 165 88C165 112.301 145.301 132 121 132H99C86.8497 132 77 141.85 77 154C77 166.15 86.8497 176 99 176H121C169.601 176 209 136.601 209 88C209 39.3989 169.601 0 121 0H99H55H33C20.8497 0 11 9.84974 11 22Z"
        fill={fill}
      />
      <path
        d="M55 176V132C55 119.85 64.8497 110 77 110H121C133.15 110 143 100.15 143 88C143 75.8497 133.15 66 121 66H55C30.6995 66 11 85.6995 11 110V132V176V198C11 210.15 20.8497 220 33 220C45.1503 220 55 210.15 55 198V176Z"
        fill={fill}
      />
    </svg>
  )
}
