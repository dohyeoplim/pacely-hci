import { useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import { AppShell } from './components/AppShell'
import { TabBar } from './components/TabBar'
import { eventLogger, logEvent } from './lib/metrics/eventLogger'
import { usePacely } from './lib/store/store'
import { buildDemoGoal } from './lib/store/seed'
import { SplashPage } from './pages/SplashPage'
import { PlanningPage } from './pages/PlanningPage'
import { HomePage } from './pages/HomePage'
import { DayStartPage } from './pages/DayStartPage'
import { FinishPage } from './pages/FinishPage'
import { RewardPage } from './pages/RewardPage'
import { RecordPage } from './pages/RecordPage'
import { ProfilePage } from './pages/ProfilePage'
import { PlanViewPage } from './pages/PlanViewPage'
import { WeekPage } from './pages/WeekPage'
import { HistoryPage } from './pages/HistoryPage'
import { ResearchPage } from './pages/ResearchPage'

const TAB_ROUTES = new Set(['/home', '/week', '/record', '/profile'])

function RootRedirect() {
  const { currentGoal } = usePacely()
  if (!currentGoal) return <Navigate to="/welcome" replace />
  if (currentGoal.status === 'finished') return <Navigate to="/finish" replace />
  return <Navigate to="/home" replace />
}

export default function App() {
  const { recordEvent, currentGoal, installGoal } = usePacely()
  const location = useLocation()
  const navigate = useNavigate()
  const seededOnce = useRef(false)
  const orchestratorPrimed = useRef(false)
  const appSessionStarted = useRef(false)
  const lastRoute = useRef<string | null>(null)

  // One-shot per mount: open a fresh app session ID, replay any persisted
  // queue from previous browser sessions, and log the open.
  useEffect(() => {
    if (appSessionStarted.current) return
    appSessionStarted.current = true
    eventLogger.resetAppSession()
    logEvent({ type: 'app_session_start' })
  }, [])

  // Route changes. We emit on every pathname transition (no double-fire
  // on the same path) so we can downstream-compute time-on-route.
  useEffect(() => {
    eventLogger.setRoute(location.pathname)
    if (lastRoute.current === location.pathname) return
    const previous = lastRoute.current
    lastRoute.current = location.pathname
    logEvent({
      type: 'route_change',
      payload: { to: location.pathname, from: previous },
    })
  }, [location.pathname])

  useEffect(() => {
    if (!currentGoal || orchestratorPrimed.current) return
    orchestratorPrimed.current = true
    void recordEvent({ type: 'app_open', goalId: currentGoal.id })
  }, [currentGoal, recordEvent])

  useEffect(() => {
    if (seededOnce.current) return
    const params = new URLSearchParams(location.search)
    const seed = params.get('seed')
    if (!seed) return
    seededOnce.current = true

    if (seed === 'reset') {
      localStorage.clear()
      navigate(location.pathname, { replace: true })
      window.location.reload()
      return
    }

    if (seed === 'demo' && !currentGoal) {
      void buildDemoGoal().then((goal) => {
        installGoal(goal)
        navigate(location.pathname, { replace: true })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  const showTabBar = TAB_ROUTES.has(location.pathname)

  return (
    <AppShell withTabBar={showTabBar}>
      <div className="route-frame" key={location.pathname}>
        <Routes location={location}>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/welcome" element={<SplashPage />} />
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/day-start" element={<DayStartPage />} />
          <Route path="/plan" element={<PlanViewPage />} />
          <Route path="/week" element={<WeekPage />} />
          <Route path="/record" element={<RecordPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/finish" element={<FinishPage />} />
          <Route path="/reward" element={<RewardPage />} />
          <Route path="/research" element={<ResearchPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {showTabBar && <TabBar />}
    </AppShell>
  )
}
