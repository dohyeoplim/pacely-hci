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
