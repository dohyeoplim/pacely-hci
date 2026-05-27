import type { MetricsPayload } from './types'

/* Thin wrappers around POST /api/metrics. The endpoint accepts:
     { action: 'log',           payload }
     { action: 'ensure-schema'           }
     { action: 'ping'                    }
   See api/metrics.ts for full schema + error semantics. */

const ENDPOINT = '/api/metrics'

interface ApiResult<T = unknown> {
  ok: boolean
  status: number
  data: T | { error: string }
}

async function call<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  try {
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await resp.json().catch(() => ({}))) as T | { error: string }
    return { ok: resp.ok, status: resp.status, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'metrics fetch failed'
    return { ok: false, status: 0, data: { error: msg } }
  }
}

export async function logMetrics(
  payload: MetricsPayload,
): Promise<ApiResult<{ ok: true }>> {
  return call<{ ok: true }>({ action: 'log', payload })
}

export async function ensureNotionSchema(): Promise<
  ApiResult<{ ok: true; properties: string[] }>
> {
  return call<{ ok: true; properties: string[] }>({ action: 'ensure-schema' })
}

export async function ensureNotionEventSchema(): Promise<
  ApiResult<{ ok: true; properties: string[] }>
> {
  return call<{ ok: true; properties: string[] }>({
    action: 'ensure-event-schema',
  })
}

export async function pingMetrics(): Promise<
  ApiResult<{
    ok: true
    hasToken: boolean
    hasDb: boolean
    hasEventDb: boolean
  }>
> {
  return call<{
    ok: true
    hasToken: boolean
    hasDb: boolean
    hasEventDb: boolean
  }>({
    action: 'ping',
  })
}
