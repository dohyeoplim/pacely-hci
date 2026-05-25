/* Phone-width container with iPhone safe areas applied. All routes render
   inside this shell so the layout is consistent across screens. */

import type { ReactNode } from 'react'

export function AppShell({ children }: { children: ReactNode }) {
  return <div className="app-shell">{children}</div>
}
