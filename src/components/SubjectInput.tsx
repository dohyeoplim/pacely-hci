import { useState } from 'react'

interface SubjectInputProps {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  suggestions?: string[]
  max?: number
}

export function SubjectInput({
  value,
  onChange,
  placeholder = '예: 선형대수, 확률통계',
  suggestions = [],
  max = 6,
}: SubjectInputProps) {
  const [draft, setDraft] = useState('')

  const add = (raw: string) => {
    const text = raw.trim()
    if (!text || value.includes(text) || value.length >= max) return
    onChange([...value, text])
    setDraft('')
  }

  const remove = (s: string) => onChange(value.filter((v) => v !== s))

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      remove(value[value.length - 1])
    }
  }

  const remaining = suggestions.filter((s) => !value.includes(s))

  return (
    <div className="subject-input">
      <div className="subject-input__row">
        <input
          className="subject-input__field"
          value={draft}
          placeholder={value.length >= max ? `최대 ${max}개까지` : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={value.length >= max}
        />
        <button
          className="subject-input__add"
          onClick={() => add(draft)}
          disabled={!draft.trim() || value.length >= max}
          aria-label="추가"
        >
          +
        </button>
      </div>

      {value.length > 0 && (
        <ul className="subject-chips">
          {value.map((s) => (
            <li key={s}>
              <button
                className="subject-chip"
                onClick={() => remove(s)}
                aria-label={`${s} 삭제`}
              >
                <span>{s}</span>
                <span className="subject-chip__x" aria-hidden>
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {remaining.length > 0 && value.length < max && (
        <div className="subject-suggestions">
          <span className="t-micro">추천</span>
          <ul>
            {remaining.map((s) => (
              <li key={s}>
                <button
                  className="subject-suggest"
                  onClick={() => add(s)}
                >
                  + {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
