import { useEffect, useState } from 'react'

import { PacelyAvatar } from './PacelyAvatar'
import { usePacely } from '../lib/store/store'

export function NotificationToast() {
  const { state, markNotificationRead } = usePacely()
  const unread = state.notifications.find((n) => !n.read)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    setClosing(false)
  }, [unread?.id])

  // Fire an OS notification only when the page is hidden so the in-app toast doesn't double up.
  useEffect(() => {
    if (!unread) return
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    if (typeof document !== 'undefined' && !document.hidden) return
    try {
      const n = new Notification('Pacely', {
        body: unread.message,
        icon: '/icon.svg',
        tag: unread.id,
      })
      setTimeout(() => n.close(), 8000)
    } catch {
      /* Notification constructor disallowed in some embeds — non-fatal */
    }
  }, [unread])

  useEffect(() => {
    if (!unread) return
    const t = setTimeout(() => {
      setClosing(true)
      setTimeout(() => markNotificationRead(unread.id), 280)
    }, 6000)
    return () => clearTimeout(t)
  }, [unread, markNotificationRead])

  if (!unread) return null

  return (
    <button
      className={`noti-toast noti-toast--${unread.trigger} ${closing ? 'noti-toast--closing' : ''}`}
      onClick={() => {
        setClosing(true)
        setTimeout(() => markNotificationRead(unread.id), 240)
      }}
      aria-label="알림 확인"
    >
      <PacelyAvatar size={32} />
      <div className="noti-toast__body">
        <div className="noti-toast__msg">{unread.message}</div>
        <div className="noti-toast__hint">탭해서 닫기</div>
      </div>
    </button>
  )
}
