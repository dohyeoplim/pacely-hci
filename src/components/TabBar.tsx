import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/home', label: '홈', icon: HomeIcon },
  { to: '/week', label: '주간', icon: WeekIcon },
  { to: '/record', label: '기록', icon: RecordIcon },
  { to: '/profile', label: '프로필', icon: ProfileIcon },
] as const

export function TabBar() {
  return (
    <nav className="tab-bar" aria-label="주요 화면">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            `tab-bar__item ${isActive ? 'tab-bar__item--active' : ''}`
          }
        >
          <t.icon />
          <span className="tab-bar__label">{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M3 10 L11 3 L19 10 V18 a1 1 0 0 1 -1 1 H14 V13 H8 V19 H4 a1 1 0 0 1 -1 -1 z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function WeekIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="3" y="5" width="16" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M3 9 H19" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M7 3 V6 M15 3 V6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="8" cy="13" r="1" fill="currentColor"/>
      <circle cx="11" cy="13" r="1" fill="currentColor"/>
      <circle cx="14" cy="13" r="1" fill="currentColor"/>
    </svg>
  )
}
function RecordIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path d="M4 16 L9 11 L12 14 L18 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="18" cy="6" r="1.5" fill="currentColor"/>
    </svg>
  )
}
function ProfileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="11" cy="8" r="4" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M3 19 a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}
