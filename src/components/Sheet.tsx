// Portaled to document.body so it escapes the route-frame's stacking context;
// otherwise the fixed tab bar (a sibling of route-frame) paints on top of the sheet.

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface SheetProps {
  open: boolean
  title?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function Sheet({ open, title, onClose, children, footer }: SheetProps) {
  const titleId = useId()
  const sheetRef = useRef<HTMLElement | null>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  // Prevents a touch-then-click double event from firing onClose twice on iOS.
  const closingRef = useRef(false)

  useEffect(() => {
    if (!open) {
      closingRef.current = false
      return
    }
    previouslyFocused.current =
      typeof document !== 'undefined'
        ? (document.activeElement as HTMLElement | null)
        : null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const t = window.setTimeout(() => {
      const root = sheetRef.current
      if (!root) return
      const first = root.querySelector<HTMLElement>(
        'input, textarea, button, [tabindex]:not([tabindex="-1"])',
      )
      ;(first ?? root).focus()
    }, 30)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      window.clearTimeout(t)
      previouslyFocused.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  const requestClose = () => {
    if (closingRef.current) return
    closingRef.current = true
    onClose()
  }

  const target = typeof document !== 'undefined' ? document.body : null
  if (!target) return null

  return createPortal(
    <div
      className="sheet-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <div
        className="sheet-backdrop"
        onPointerDown={(e) => {
          e.preventDefault()
          requestClose()
        }}
      />
      <section
        ref={sheetRef}
        className="sheet"
        tabIndex={-1}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="sheet__grabber" aria-hidden />
        {title && (
          <header className="sheet__head">
            <h2 id={titleId} className="sheet__title">
              {title}
            </h2>
            <button
              className="sheet__close"
              onClick={requestClose}
              aria-label="닫기"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                <path
                  d="M3 3 L13 13 M13 3 L3 13"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </header>
        )}
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__footer">{footer}</div>}
      </section>
    </div>,
    target,
  )
}
