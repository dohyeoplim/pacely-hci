/* Bottom sheet primitive — backdrop + sliding panel.

   Used for any modal flow that wants a clean "stay in the page" feel. Close
   on backdrop tap or the explicit close button; ESC also closes for keyboard
   users. Body scroll is locked while open. */

import { useEffect, type ReactNode } from 'react'

interface SheetProps {
  open: boolean
  title?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function Sheet({ open, title, onClose, children, footer }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="sheet-root" role="dialog" aria-modal>
      <div className="sheet-backdrop" onClick={onClose} />
      <section className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grabber" aria-hidden />
        {title && (
          <header className="sheet__head">
            <h2 className="sheet__title">{title}</h2>
            <button
              className="sheet__close"
              onClick={onClose}
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
    </div>
  )
}
