import type { ReactNode } from 'react'

import { PacelyAvatar } from './PacelyAvatar'

interface ChatBubbleProps {
  from: 'pacely' | 'user'
  children: ReactNode
  /** Hide the Pacely avatar (when stacking consecutive Pacely bubbles). */
  hideAvatar?: boolean
}

/* Pacely's chat row stacks vertically — avatar on top, bubble below — so
   consecutive bubbles read as a left-aligned column at the same x position.
   User rows stay right-aligned. */
export function ChatBubble({ from, children, hideAvatar }: ChatBubbleProps) {
  if (from === 'pacely') {
    return (
      <div
        className={`chat-row chat-row--pacely ${
          hideAvatar ? 'chat-row--continuation' : ''
        }`}
      >
        {!hideAvatar && (
          <div className="chat-row__avatar">
            <PacelyAvatar size={28} />
          </div>
        )}
        <div className="chat-bubble chat-bubble--pacely">{children}</div>
      </div>
    )
  }
  return (
    <div className="chat-row chat-row--user">
      <div className="chat-bubble chat-bubble--user">{children}</div>
    </div>
  )
}
