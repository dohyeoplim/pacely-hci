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
    // storage full / unavailable — non-fatal
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* noop */
  }
}
