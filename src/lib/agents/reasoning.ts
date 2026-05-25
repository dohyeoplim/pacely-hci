/* Reasoning backbone implementations.

   `MockReasoningEngine` simulates latency and echoes a deterministic stub —
   the mock agents don't route their logic through it, but it exists so the
   `ReasoningEngine` seam is real and a Claude-backed engine can replace it. */

import type { ReasoningEngine } from './types'

export class MockReasoningEngine implements ReasoningEngine {
  readonly name = 'mock'

  async complete(prompt: string): Promise<string> {
    await delay(160 + Math.random() * 320)
    return `[mock] ${prompt.slice(0, 64)}`
  }
}

/**
 * Placeholder for the real backbone. Wiring this up means: add a Vite-side
 * route handler (or serverless fn) that proxies the Anthropic API, then have
 * `complete()` POST to it. Kept unimplemented on purpose.
 */
export class ClaudeReasoningEngine implements ReasoningEngine {
  readonly name = 'claude'
  readonly endpoint: string
  constructor(endpoint: string) {
    this.endpoint = endpoint
  }
  async complete(): Promise<string> {
    throw new Error(
      `ClaudeReasoningEngine not wired up (endpoint: ${this.endpoint})`,
    )
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
