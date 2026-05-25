import { useNavigate } from 'react-router-dom'

export function BackButton({ onClick }: { onClick?: () => void }) {
  const navigate = useNavigate()
  return (
    <button
      className="back-btn"
      aria-label="뒤로 가기"
      onClick={onClick ?? (() => navigate(-1))}
    >
      <svg width="14" height="22" viewBox="0 0 14 22" fill="none" aria-hidden>
        <path
          d="M12 2 L2 11 L12 20"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
