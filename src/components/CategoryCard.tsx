import type { GoalCategory } from '../types'

const META: Record<GoalCategory, { emoji: string; label: string }> = {
  project: { emoji: '💻', label: '새로운 프로젝트' },
  workout: { emoji: '🏋️‍♂️', label: '운동' },
  exam: { emoji: '📚', label: '시험 공부' },
  diary: { emoji: '📝', label: '일기 쓰기' },
  custom: { emoji: '✏️', label: '직접 입력' },
}

export const CATEGORY_ORDER: GoalCategory[] = [
  'project',
  'workout',
  'exam',
  'diary',
  'custom',
]

export function categoryLabel(c: GoalCategory): string {
  return META[c].label
}

interface CategoryCardProps {
  category: GoalCategory
  onClick: () => void
}

export function CategoryCard({ category, onClick }: CategoryCardProps) {
  const meta = META[category]
  return (
    <button className="category-card" onClick={onClick}>
      <span className="category-card__emoji" aria-hidden>
        {meta.emoji}
      </span>
      <span className="category-card__label">{meta.label}</span>
      <span className="category-card__chevron" aria-hidden>
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
          <path
            d="M1 1 L7 7 L1 13"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  )
}
