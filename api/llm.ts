/* Pacely LLM proxy — Vercel serverless function.

   The Pacely client is a static Vite PWA, so the OpenAI key MUST stay on
   the server. This function accepts a structured chat request from the
   client and forwards it to OpenAI's Chat Completions endpoint using the
   key stored as an unprefixed Vercel env var (`OPENAI_API_KEY`).

   The agents call this through `src/lib/agents/openai/client.ts`. */

import OpenAI from 'openai'

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface LlmRequest {
  messages: ChatMessage[]
  model?: string
  /** Pass-through for OpenAI structured output. */
  responseFormat?: 'text' | 'json'
  maxTokens?: number
  temperature?: number
}

interface LlmResponse {
  content: string
}

interface LlmError {
  error: string
}

const DEFAULT_MODEL = 'gpt-4o-mini'

function bad(res: Response, code: number, msg: string): Response {
  return new Response(JSON.stringify({ error: msg } satisfies LlmError), {
    status: code,
    headers: { 'content-type': 'application/json' },
  })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return bad(new Response(), 405, 'Method Not Allowed')
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return bad(new Response(), 500, 'OPENAI_API_KEY not configured on server')
  }

  let body: LlmRequest
  try {
    body = (await req.json()) as LlmRequest
  } catch {
    return bad(new Response(), 400, 'Invalid JSON body')
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return bad(new Response(), 400, 'messages must be a non-empty array')
  }

  const client = new OpenAI({ apiKey })

  try {
    const completion = await client.chat.completions.create({
      model: body.model ?? DEFAULT_MODEL,
      messages: body.messages,
      max_tokens: body.maxTokens ?? 1200,
      temperature: body.temperature ?? 0.7,
      response_format:
        body.responseFormat === 'json'
          ? { type: 'json_object' }
          : { type: 'text' },
    })
    const content = completion.choices[0]?.message?.content ?? ''
    return new Response(
      JSON.stringify({ content } satisfies LlmResponse),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
          /* No caching — every call should hit the model. */
          'cache-control': 'no-store',
        },
      },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OpenAI request failed'
    return bad(new Response(), 502, msg)
  }
}

/* Vercel Node runtime config — keeps cold-start light and uses Node 20. */
export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
}
