/* Two small ribbons shown on the home page when the user can opt into
   richer native features: "Add to Home Screen" and "Allow notifications".

   Both ribbons remember their dismissal in localStorage so users only see
   them once per choice. */

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const INSTALL_KEY = 'pacely.install.dismissed'
const NOTI_KEY = 'pacely.notification.dismissed'

export function PwaPrompts() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [installDismissed, setInstallDismissed] = useState(
    () => typeof localStorage !== 'undefined' && !!localStorage.getItem(INSTALL_KEY),
  )
  const [notiState, setNotiState] = useState<NotificationPermission | null>(
    () =>
      typeof Notification !== 'undefined' ? Notification.permission : null,
  )
  const [notiDismissed, setNotiDismissed] = useState(
    () => typeof localStorage !== 'undefined' && !!localStorage.getItem(NOTI_KEY),
  )

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const showInstall = !!installEvent && !installDismissed
  const showNoti =
    notiState === 'default' && !notiDismissed && typeof Notification !== 'undefined'

  if (!showInstall && !showNoti) return null

  return (
    <div className="pwa-prompts">
      {showInstall && (
        <div className="pwa-ribbon">
          <div className="pwa-ribbon__emoji" aria-hidden>📲</div>
          <div className="pwa-ribbon__body">
            <div className="t-body-strong">홈 화면에 추가하기</div>
            <div className="t-caption">앱처럼 켜고 끄세요.</div>
          </div>
          <button
            className="pwa-ribbon__primary"
            onClick={async () => {
              if (!installEvent) return
              await installEvent.prompt()
              await installEvent.userChoice
              localStorage.setItem(INSTALL_KEY, '1')
              setInstallEvent(null)
              setInstallDismissed(true)
            }}
          >
            설치
          </button>
          <button
            className="pwa-ribbon__close"
            aria-label="닫기"
            onClick={() => {
              localStorage.setItem(INSTALL_KEY, '1')
              setInstallDismissed(true)
            }}
          >
            ×
          </button>
        </div>
      )}

      {showNoti && (
        <div className="pwa-ribbon">
          <div className="pwa-ribbon__emoji" aria-hidden>🔔</div>
          <div className="pwa-ribbon__body">
            <div className="t-body-strong">알림 받기</div>
            <div className="t-caption">Pacely의 페이스 메시지를 놓치지 마세요.</div>
          </div>
          <button
            className="pwa-ribbon__primary"
            onClick={async () => {
              const perm = await Notification.requestPermission()
              setNotiState(perm)
              if (perm !== 'default') {
                localStorage.setItem(NOTI_KEY, '1')
                setNotiDismissed(true)
              }
            }}
          >
            허용
          </button>
          <button
            className="pwa-ribbon__close"
            aria-label="닫기"
            onClick={() => {
              localStorage.setItem(NOTI_KEY, '1')
              setNotiDismissed(true)
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
