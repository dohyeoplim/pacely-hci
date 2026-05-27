type Role = 'system' | 'user' | 'assistant'

interface ChatMessage {
  role: Role
  content: string
}

interface LlmRequest {
  messages: ChatMessage[]
  model?: string
  responseFormat?: 'text' | 'json'
  maxTokens?: number
  temperature?: number
}

const DEFAULT_MODEL = 'gpt-4o-mini'
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405)
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return json({ error: 'OPENAI_API_KEY not configured on server' }, 500)
  }

  let body: LlmRequest
  try {
    body = (await req.json()) as LlmRequest
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: 'messages must be a non-empty array' }, 400)
  }

  const upstream = {
    model: body.model ?? DEFAULT_MODEL,
    messages: body.messages,
    max_tokens: body.maxTokens ?? 1200,
    temperature: body.temperature ?? 0.7,
    response_format:
      body.responseFormat === 'json'
        ? { type: 'json_object' }
        : { type: 'text' },
  }

  try {
    const resp = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(upstream),
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      return json(
        { error: `OpenAI ${resp.status}: ${errText.slice(0, 300)}` },
        502,
      )
    }

    const data = (await resp.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = data.choices?.[0]?.message?.content ?? ''
    return json({ content })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OpenAI request failed'
    return json({ error: msg }, 502)
  }
}

export const config = {
  runtime: 'edge',
}
