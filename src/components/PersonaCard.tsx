import type { Persona } from '../types'

interface PersonaCardProps {
  persona: Persona
  active: boolean
  onClick: () => void
}

const META: Record<Persona, { label: string; dot: string; sub: string }> = {
  gentle: {
    label: '온화한 동반자',
    dot: 'var(--pacely)',
    sub: '따뜻하게 응원해요',
  },
  strict: {
    label: '엄격한 코치',
    dot: '#C084FC',
    sub: '단호하게 이끌어요',
  },
}

export function PersonaCard({ persona, active, onClick }: PersonaCardProps) {
  const m = META[persona]
  return (
    <button
      className={`persona-card ${active ? 'persona-card--active' : ''}`}
      onClick={onClick}
    >
      <span className="persona-card__dot" style={{ background: m.dot }} />
      <span className="persona-card__label">{m.label}</span>
      <span className="persona-card__sub">{m.sub}</span>
    </button>
  )
}
