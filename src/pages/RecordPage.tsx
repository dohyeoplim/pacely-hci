/* Record — recent notifications + mission log. Stub view, accessible from
   the home tab bar. */

import { Navigate } from 'react-router-dom'

import { usePacely } from '../lib/store/store'

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}.${d.getDate()}`
}

export function RecordPage() {
  const { currentGoal, state } = usePacely()
  if (!currentGoal) return <Navigate to="/welcome" replace />

  const recentMissions = [...currentGoal.missions]
    .filter((m) => m.completed)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    .slice(0, 12)

  return (
    <div className="page record-page">
      <header className="record-head">
        <h1 className="t-title-lg">기록</h1>
        <p className="t-caption">함께 달려온 자취예요.</p>
      </header>

      <section className="record-section">
        <h2 className="t-title">최근 알림</h2>
        {state.notifications.length === 0 ? (
          <p className="record-empty t-caption">아직 알림이 없어요.</p>
        ) : (
          <ul className="noti-list">
            {state.notifications.slice(0, 8).map((n) => (
              <li key={n.id} className="noti-item">
                <span className={`noti-dot noti-dot--${n.trigger}`} aria-hidden />
                <div className="noti-body">
                  <div className="t-body">{n.message}</div>
                  <div className="t-micro">{n.trigger}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="record-section">
        <h2 className="t-title">완료한 미션</h2>
        {recentMissions.length === 0 ? (
          <p className="record-empty t-caption">완료한 미션이 곧 쌓일 거예요.</p>
        ) : (
          <ul className="record-mission-list">
            {recentMissions.map((m) => (
              <li key={m.id} className="record-mission">
                <span className="record-mission__date">{fmtDate(m.date)}</span>
                <span className="record-mission__title">{m.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  )
}
