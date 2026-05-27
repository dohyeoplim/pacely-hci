export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CallLLMOptions {
  model?: string
  responseFormat?: 'text' | 'json'
  maxTokens?: number
  temperature?: number
}

const ENDPOINT = '/api/llm'

export async function callLLM(
  messages: ChatMessage[],
  opts: CallLLMOptions = {},
): Promise<string> {
  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messages,
      model: opts.model,
      responseFormat: opts.responseFormat ?? 'text',
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
    }),
  })
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`LLM request failed (${resp.status}): ${body || resp.statusText}`)
  }
  const data = (await resp.json()) as { content?: string }
  return data.content ?? ''
}

export function parseJsonResponse<T>(raw: string): T {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
  return JSON.parse(trimmed) as T
}
