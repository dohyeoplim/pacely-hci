import { formatHours } from '../lib/util'

interface HomeStatsProps {
  streak: number
  bestStreak: number
  totalHours: number
}

export function HomeStats({ streak, bestStreak, totalHours }: HomeStatsProps) {
  const showStreak = streak > 0
  const showBest = bestStreak > streak && bestStreak >= 3

  return (
    <div className="home-stats">
      <div className="home-stats__pill">
        <span aria-hidden>🔥</span>
        <span className="home-stats__value">
          {showStreak ? `${streak}일 연속` : '오늘부터 시작'}
        </span>
        {showBest && (
          <span className="home-stats__sub">최고 {bestStreak}일</span>
        )}
      </div>
      <div className="home-stats__pill">
        <span aria-hidden>⏱️</span>
        <span className="home-stats__value">{formatHours(totalHours)} 누적</span>
      </div>
    </div>
  )
}
