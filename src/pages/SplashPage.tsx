import { useNavigate } from 'react-router-dom'

import { Button } from '../components/Button'
import { Logo } from '../components/Logo'

export function SplashPage() {
  const navigate = useNavigate()
  return (
    <div className="splash-page page">
      <div className="splash-page__bg" aria-hidden />
      <div className="splash-page__inner">
        <Logo size={56} />
        <h1 className="splash-page__title">Pacely</h1>
        <p className="splash-page__tagline">같은 페이스로, 함께.</p>
      </div>
      <div className="splash-page__cta">
        <Button block onClick={() => navigate('/planning')}>
          시작하기
        </Button>
      </div>
    </div>
  )
}
