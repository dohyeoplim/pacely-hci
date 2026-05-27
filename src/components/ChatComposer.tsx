/* Full-width chat composer — textarea + send button, sized like a real
   messaging app input. Auto-grows vertically with content (no fixed cols
   width), submits on Enter (Shift+Enter for newline). */

import { useEffect, useRef } from 'react'

interface ChatComposerProps {
  value: string
  placeholder?: string
  disabled?: boolean
  sendLabel?: string
  onChange: (v: string) => void
  onSubmit: () => void
  autoFocus?: boolean
}

export function ChatComposer({
  value,
  placeholder = '여기에 입력하세요',
  disabled = false,
  sendLabel = '보내기',
  onChange,
  onSubmit,
  autoFocus,
}: ChatComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  /* Height autosize — width is fixed to the container so we only adjust
     height as the content wraps. */
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [value])

  const trySubmit = () => {
    if (disabled) return
    if (!value.trim()) return
    onSubmit()
  }

  return (
    <div className="chat-composer">
      <textarea
        ref={ref}
        className="chat-composer__input"
        value={value}
        placeholder={placeholder}
        rows={1}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            trySubmit()
          }
        }}
      />
      <button
        type="button"
        className="chat-composer__send"
        aria-label={sendLabel}
        disabled={disabled || !value.trim()}
        onClick={trySubmit}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
          <path
            d="M2 9 L16 9 M10 3 L16 9 L10 15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}
