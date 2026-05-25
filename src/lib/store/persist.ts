/* localStorage persistence for the Pacely store.

   The whole state tree is serialized under one key. Mission checks are also
   mirrored into an offline sync queue (see store.tsx) so core records survive
   without a network — spec §6 offline requirement. */

import type { PacelyState } from './store'

const KEY = 'pacely.state.v1'

export function loadState(): PacelyState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as PacelyState
  } catch {
    return null
  }
}

export function saveState(state: PacelyState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage full / unavailable — non-fatal for a demo PWA
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* noop */
  }
}
