import type { ReasoningEngine } from './types'

export class MockReasoningEngine implements ReasoningEngine {
  readonly name = 'mock'

  async complete(prompt: string): Promise<string> {
    await delay(160 + Math.random() * 320)
    return `[mock] ${prompt.slice(0, 64)}`
  }
}

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
