/* Phone-width container with iPhone safe areas applied. All routes render
   inside this shell so the layout is consistent across screens. When the
   current route has a bottom tab bar, the shell reserves room for it via a
   modifier class so the fixed bar never overlaps page content. */

import type { ReactNode } from 'react'

export function AppShell({
  children,
  withTabBar = false,
}: {
  children: ReactNode
  withTabBar?: boolean
}) {
  return (
    <div className={`app-shell${withTabBar ? ' app-shell--tabbed' : ''}`}>
      {children}
    </div>
  )
}
