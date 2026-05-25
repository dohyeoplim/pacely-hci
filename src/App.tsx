import { useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import { AppShell } from './components/AppShell'
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

  // Fire an app_open once the user has a goal so the orchestrator can
  // generate its first contextual notification. Without this gate the seed
  // path would fire too early — before currentGoal is in scope.
  useEffect(() => {
    if (!currentGoal || orchestratorPrimed.current) return
    orchestratorPrimed.current = true
    void recordEvent({ type: 'app_open', goalId: currentGoal.id })
  }, [currentGoal, recordEvent])

  // `?seed=demo` populates the store with a realistic in-progress goal so the
  // home / day-start / finish screens can be opened directly for demos.
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
        // Strip the query string after seeding.
        navigate(location.pathname, { replace: true })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  return (
    <AppShell>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </AppShell>
  )
}
