/* Pacely — HCI evaluation metric collector.

   Two streams, one Edge function:

     • Session summaries → NOTION_DB_ID
       One row per completed plan-creation session. Includes objective
       plan-quality metrics + subjective survey responses.
       Actions: `log`, `ensure-schema`.

     • Event stream → NOTION_EVENT_DB_ID
       One row per discrete interaction (mission completed, route change,
       sheet opened, notification read, app foreground/background...).
       Actions: `event` (batch insert), `ensure-event-schema`.

   Auth:  NOTION_PAT (server-only)         — Notion internal integration

   Both schemas auto-provision on first failed log: if the page-create
   400s with a missing-property error, the handler PATCHes the database
   with the latest schema and retries the original write once. */

type ExperimentGroup = 'template' | 'pacely'
type Persona = 'gentle' | 'strict'
type PersonaOrder = 'companion-first' | 'coach-first'
type GoalCategory = 'exam' | 'project' | 'workout' | 'diary' | 'custom'
type Backend = 'mock' | 'openai'
type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

type EventType =
  | 'app_session_start'
  | 'app_session_end'
  | 'app_open'
  | 'app_close'
  | 'route_change'
  | 'plan_created'
  | 'plan_revised'
  | 'plan_regenerated'
  | 'day_started'
  | 'mission_completed'
  | 'mission_uncompleted'
  | 'mission_missed'
  | 'mission_added'
  | 'mission_edited'
  | 'mission_deleted'
  | 'sheet_opened'
  | 'sheet_closed'
  | 'notification_received'
  | 'notification_read'
  | 'goal_finished'
  | 'goal_abandoned'
  | 'goal_switched'
  | 'survey_submitted'
  | 'survey_skipped'

interface EventPayload {
  // identity
  eventId: string
  appSessionId: string
  planSessionId: string
  timestamp: string
  eventType: EventType
  participantId: string

  // context
  route: string
  goalId: string
  missionId: string
  timeSinceAppOpenSec: number
  timeOfDay: TimeOfDay
  dayOfWeek: number
  hourOfDay: number
  appVersion: string
  backend: Backend
  experimentGroup: ExperimentGroup | null
  persona: Persona
  personaOrder: PersonaOrder | null

  // event facets (null/empty when not applicable to event type)
  goalTitle: string
  goalCategory: GoalCategory | null
  goalAdherenceRate: number | null
  currentStreak: number | null
  totalHours: number | null
  missionTitle: string
  missionEstimatedMin: number | null
  missionWasLate: boolean
  milestoneReached: boolean
  notificationTrigger: string
  sheetName: string

  payloadJson: string
}

interface MetricsPayload {
  // identity
  sessionId: string
  planId: string
  timestamp: string // ISO 8601 with timezone offset
  participantId: string
  appVersion: string
  backend: Backend

  // experiment
  experimentGroup: ExperimentGroup | null
  persona: Persona
  personaOrder: PersonaOrder | null
  rewardEnabled: boolean

  // goal context
  goalText: string
  shortTitle: string
  goalCategory: GoalCategory
  planSpanDays: number
  dailyHours: number
  subjectCount: number
  milestoneCount: number

  // process — timing (seconds)
  planDurationSec: number
  timeOnGoalSec: number
  timeOnPeriodSec: number
  timeOnHoursSec: number
  timeOnPersonaSec: number
  timeOnPlanSec: number
  planGenerationSec: number
  goalParseSec: number

  // process — interaction counts
  revisionCount: number
  planRegenerationCount: number
  missionAddCount: number
  missionEditCount: number
  missionDeleteCount: number
  totalMissionEdits: number
  retryCount: number

  // plan structure
  subtaskCount: number
  subtasksPerDayMean: number
  subtasksPerDaySd: number
  taskDurationMeanMin: number
  taskDurationSdMin: number

  // plan quality (heuristic, 0–1 unless noted)
  actionableTaskCount: number
  actionableTaskRate: number
  specificityScoreMean: number
  timeClarityScore: number
  priorityClarityScore: number

  // subjective (1–7 Likert, null when skipped)
  preBurden: number | null
  postBurden: number | null
  burdenReduction: number | null
  confidence: number | null
  planClarity: number | null
  immediateActionability: number | null
  nasaTlxMental: number | null
  nasaTlxTemporal: number | null
  nasaTlxEffort: number | null
  nasaTlxFrustration: number | null
  preSurveyCompleted: boolean
  postSurveyCompleted: boolean

  // misc
  locale: string
  userAgent: string
  rawJson: string
}

interface LogBody {
  action: 'log'
  payload: MetricsPayload
}
interface EnsureBody {
  action: 'ensure-schema'
}
interface EventBody {
  action: 'event'
  payload: EventPayload | EventPayload[]
}
interface EnsureEventBody {
  action: 'ensure-event-schema'
}
interface PingBody {
  action: 'ping'
}
type RequestBody =
  | LogBody
  | EnsureBody
  | EventBody
  | EnsureEventBody
  | PingBody

const NOTION_VERSION = '2022-06-28'
const NOTION_BASE = 'https://api.notion.com/v1'

/* ───────────────────────── Notion schema definition ─────────────────────── */

/* Map from semantic field → (Notion property name, type definition).
   Both session-summary and event-stream tables share this shape; the
   `field` strings are checked at call-site against the relevant payload
   interface. */

type SchemaCol =
  | { field: string; name: string; kind: 'rich_text' }
  | { field: string; name: string; kind: 'number' }
  | { field: string; name: string; kind: 'checkbox' }
  | { field: string; name: string; kind: 'date' }
  | { field: string; name: string; kind: 'select'; options: string[] }

const SCHEMA: SchemaCol[] = [
  // identity
  { field: 'sessionId', name: 'Session ID', kind: 'rich_text' },
  { field: 'planId', name: 'Plan ID', kind: 'rich_text' },
  { field: 'timestamp', name: 'Timestamp', kind: 'date' },
  { field: 'participantId', name: 'Participant ID', kind: 'rich_text' },
  { field: 'appVersion', name: 'App Version', kind: 'rich_text' },
  {
    field: 'backend',
    name: 'Backend',
    kind: 'select',
    options: ['mock', 'openai'],
  },

  // experiment
  {
    field: 'experimentGroup',
    name: 'Experiment Group',
    kind: 'select',
    options: ['template', 'pacely', 'unset'],
  },
  {
    field: 'persona',
    name: 'Persona',
    kind: 'select',
    options: ['gentle', 'strict'],
  },
  {
    field: 'personaOrder',
    name: 'Persona Order',
    kind: 'select',
    options: ['companion-first', 'coach-first', 'unset'],
  },
  { field: 'rewardEnabled', name: 'Reward Enabled', kind: 'checkbox' },

  // goal context
  { field: 'goalText', name: 'Goal Text', kind: 'rich_text' },
  { field: 'shortTitle', name: 'Short Title', kind: 'rich_text' },
  {
    field: 'goalCategory',
    name: 'Goal Category',
    kind: 'select',
    options: ['exam', 'project', 'workout', 'diary', 'custom'],
  },
  { field: 'planSpanDays', name: 'Plan Span (days)', kind: 'number' },
  { field: 'dailyHours', name: 'Daily Hours', kind: 'number' },
  { field: 'subjectCount', name: 'Subject Count', kind: 'number' },
  { field: 'milestoneCount', name: 'Milestone Count', kind: 'number' },

  // process — timing
  { field: 'planDurationSec', name: 'Plan Duration (s)', kind: 'number' },
  { field: 'timeOnGoalSec', name: 'Time on Goal Step (s)', kind: 'number' },
  { field: 'timeOnPeriodSec', name: 'Time on Period Step (s)', kind: 'number' },
  { field: 'timeOnHoursSec', name: 'Time on Hours Step (s)', kind: 'number' },
  {
    field: 'timeOnPersonaSec',
    name: 'Time on Persona Step (s)',
    kind: 'number',
  },
  { field: 'timeOnPlanSec', name: 'Time on Plan Step (s)', kind: 'number' },
  {
    field: 'planGenerationSec',
    name: 'Plan Generation Time (s)',
    kind: 'number',
  },
  { field: 'goalParseSec', name: 'Goal Parse Time (s)', kind: 'number' },

  // process — interaction
  { field: 'revisionCount', name: 'Revision Count', kind: 'number' },
  {
    field: 'planRegenerationCount',
    name: 'Plan Regeneration Count',
    kind: 'number',
  },
  { field: 'missionAddCount', name: 'Mission Add Count', kind: 'number' },
  { field: 'missionEditCount', name: 'Mission Edit Count', kind: 'number' },
  { field: 'missionDeleteCount', name: 'Mission Delete Count', kind: 'number' },
  { field: 'totalMissionEdits', name: 'Total Mission Edits', kind: 'number' },
  { field: 'retryCount', name: 'Retry Count', kind: 'number' },

  // plan structure
  { field: 'subtaskCount', name: 'Subtask Count', kind: 'number' },
  {
    field: 'subtasksPerDayMean',
    name: 'Subtasks per Day Mean',
    kind: 'number',
  },
  { field: 'subtasksPerDaySd', name: 'Subtasks per Day SD', kind: 'number' },
  {
    field: 'taskDurationMeanMin',
    name: 'Task Duration Mean (min)',
    kind: 'number',
  },
  {
    field: 'taskDurationSdMin',
    name: 'Task Duration SD (min)',
    kind: 'number',
  },

  // plan quality
  {
    field: 'actionableTaskCount',
    name: 'Actionable Task Count',
    kind: 'number',
  },
  { field: 'actionableTaskRate', name: 'Actionable Task Rate', kind: 'number' },
  {
    field: 'specificityScoreMean',
    name: 'Specificity Score Mean',
    kind: 'number',
  },
  { field: 'timeClarityScore', name: 'Time Clarity Score', kind: 'number' },
  {
    field: 'priorityClarityScore',
    name: 'Priority Clarity Score',
    kind: 'number',
  },

  // subjective
  { field: 'preBurden', name: 'Pre Burden (1-7)', kind: 'number' },
  { field: 'postBurden', name: 'Post Burden (1-7)', kind: 'number' },
  { field: 'burdenReduction', name: 'Burden Reduction', kind: 'number' },
  { field: 'confidence', name: 'Confidence (1-7)', kind: 'number' },
  { field: 'planClarity', name: 'Plan Clarity (1-7)', kind: 'number' },
  {
    field: 'immediateActionability',
    name: 'Immediate Actionability (1-7)',
    kind: 'number',
  },
  { field: 'nasaTlxMental', name: 'NASA-TLX Mental (1-7)', kind: 'number' },
  { field: 'nasaTlxTemporal', name: 'NASA-TLX Temporal (1-7)', kind: 'number' },
  { field: 'nasaTlxEffort', name: 'NASA-TLX Effort (1-7)', kind: 'number' },
  {
    field: 'nasaTlxFrustration',
    name: 'NASA-TLX Frustration (1-7)',
    kind: 'number',
  },
  { field: 'preSurveyCompleted', name: 'Pre Survey Completed', kind: 'checkbox' },
  {
    field: 'postSurveyCompleted',
    name: 'Post Survey Completed',
    kind: 'checkbox',
  },

  // misc
  { field: 'locale', name: 'Locale', kind: 'rich_text' },
  { field: 'userAgent', name: 'User Agent', kind: 'rich_text' },
  { field: 'rawJson', name: 'Raw Metrics (JSON)', kind: 'rich_text' },
]

const EVENT_TYPE_OPTIONS: EventType[] = [
  'app_session_start',
  'app_session_end',
  'app_open',
  'app_close',
  'route_change',
  'plan_created',
  'plan_revised',
  'plan_regenerated',
  'day_started',
  'mission_completed',
  'mission_uncompleted',
  'mission_missed',
  'mission_added',
  'mission_edited',
  'mission_deleted',
  'sheet_opened',
  'sheet_closed',
  'notification_received',
  'notification_read',
  'goal_finished',
  'goal_abandoned',
  'goal_switched',
  'survey_submitted',
  'survey_skipped',
]

const EVENT_SCHEMA: SchemaCol[] = [
  // identity
  { field: 'eventId', name: 'Event ID', kind: 'rich_text' },
  { field: 'appSessionId', name: 'App Session ID', kind: 'rich_text' },
  { field: 'planSessionId', name: 'Plan Session ID', kind: 'rich_text' },
  { field: 'timestamp', name: 'Timestamp', kind: 'date' },
  {
    field: 'eventType',
    name: 'Event Type',
    kind: 'select',
    options: EVENT_TYPE_OPTIONS,
  },
  { field: 'participantId', name: 'Participant ID', kind: 'rich_text' },

  // context
  { field: 'route', name: 'Route', kind: 'rich_text' },
  { field: 'goalId', name: 'Goal ID', kind: 'rich_text' },
  { field: 'missionId', name: 'Mission ID', kind: 'rich_text' },
  {
    field: 'timeSinceAppOpenSec',
    name: 'Time Since App Open (s)',
    kind: 'number',
  },
  {
    field: 'timeOfDay',
    name: 'Time of Day',
    kind: 'select',
    options: ['morning', 'afternoon', 'evening', 'night'],
  },
  { field: 'dayOfWeek', name: 'Day of Week', kind: 'number' },
  { field: 'hourOfDay', name: 'Hour of Day', kind: 'number' },
  { field: 'appVersion', name: 'App Version', kind: 'rich_text' },
  {
    field: 'backend',
    name: 'Backend',
    kind: 'select',
    options: ['mock', 'openai'],
  },
  {
    field: 'experimentGroup',
    name: 'Experiment Group',
    kind: 'select',
    options: ['template', 'pacely', 'unset'],
  },
  {
    field: 'persona',
    name: 'Persona',
    kind: 'select',
    options: ['gentle', 'strict'],
  },
  {
    field: 'personaOrder',
    name: 'Persona Order',
    kind: 'select',
    options: ['companion-first', 'coach-first', 'unset'],
  },

  // facets
  { field: 'goalTitle', name: 'Goal Title', kind: 'rich_text' },
  {
    field: 'goalCategory',
    name: 'Goal Category',
    kind: 'select',
    options: ['exam', 'project', 'workout', 'diary', 'custom', 'unset'],
  },
  { field: 'goalAdherenceRate', name: 'Goal Adherence Rate', kind: 'number' },
  { field: 'currentStreak', name: 'Current Streak', kind: 'number' },
  { field: 'totalHours', name: 'Total Hours', kind: 'number' },
  { field: 'missionTitle', name: 'Mission Title', kind: 'rich_text' },
  {
    field: 'missionEstimatedMin',
    name: 'Mission Estimated Min',
    kind: 'number',
  },
  { field: 'missionWasLate', name: 'Mission Was Late', kind: 'checkbox' },
  { field: 'milestoneReached', name: 'Milestone Reached', kind: 'checkbox' },
  {
    field: 'notificationTrigger',
    name: 'Notification Trigger',
    kind: 'select',
    options: [
      'entry',
      'milestone',
      'stats',
      'dday',
      'procrastination',
      'emotion',
      'social',
      'lowburden',
      'unset',
    ],
  },
  { field: 'sheetName', name: 'Sheet Name', kind: 'rich_text' },
  { field: 'payloadJson', name: 'Payload (JSON)', kind: 'rich_text' },
]

function schemaProperties(schema: SchemaCol[]): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const col of schema) {
    switch (col.kind) {
      case 'rich_text':
        props[col.name] = { rich_text: {} }
        break
      case 'number':
        props[col.name] = { number: { format: 'number' } }
        break
      case 'checkbox':
        props[col.name] = { checkbox: {} }
        break
      case 'date':
        props[col.name] = { date: {} }
        break
      case 'select':
        props[col.name] = {
          select: { options: col.options.map((name) => ({ name })) },
        }
        break
    }
  }
  return props
}

/* ───────────────────────────── Page conversion ──────────────────────────── */

/* Notion's rich_text content is capped at 2000 chars per chunk; we trim
   long fields (goal text, raw JSON) so the request never 400s. */
const RT_LIMIT = 1900

function richText(value: string | null | undefined): unknown {
  const s = (value ?? '').toString()
  const clipped = s.length > RT_LIMIT ? s.slice(0, RT_LIMIT - 3) + '...' : s
  return { rich_text: [{ text: { content: clipped } }] }
}

function titleText(value: string): unknown {
  const clipped = value.length > 180 ? value.slice(0, 177) + '...' : value
  return { title: [{ text: { content: clipped } }] }
}

function selectOpt(value: string | null | undefined): unknown {
  const v = (value ?? '').toString().trim()
  if (!v) return { select: { name: 'unset' } }
  return { select: { name: v } }
}

function numberCell(value: number | null | undefined): unknown {
  if (value == null || !Number.isFinite(value)) return { number: null }
  return { number: value }
}

function checkboxCell(value: boolean | null | undefined): unknown {
  return { checkbox: !!value }
}

function dateCell(iso: string): unknown {
  return { date: { start: iso } }
}

function titleFromSession(p: MetricsPayload): string {
  const pid = p.participantId || 'guest'
  const cat = p.goalCategory
  const t = p.shortTitle || p.goalText.slice(0, 18) || cat
  const day = (p.timestamp || new Date().toISOString()).slice(0, 10)
  return `${pid} · ${day} · ${t}`
}

function titleFromEvent(p: EventPayload): string {
  const pid = p.participantId || 'guest'
  const t = p.timestamp || new Date().toISOString()
  // Time portion (HH:MM:SS) makes the event row sortable at a glance in
  // the Notion timeline view.
  const time = t.length >= 19 ? t.slice(11, 19) : t.slice(0, 19)
  return `${pid} · ${time} · ${p.eventType}`
}

function payloadToProperties(
  schema: SchemaCol[],
  payload: Record<string, unknown>,
  title: string,
): Record<string, unknown> {
  const props: Record<string, unknown> = {
    Name: titleText(title),
  }
  for (const col of schema) {
    const v = payload[col.field]
    switch (col.kind) {
      case 'rich_text':
        props[col.name] = richText(v as string | null | undefined)
        break
      case 'number':
        props[col.name] = numberCell(v as number | null | undefined)
        break
      case 'checkbox':
        props[col.name] = checkboxCell(v as boolean | null | undefined)
        break
      case 'date':
        props[col.name] = dateCell((v as string) || new Date().toISOString())
        break
      case 'select':
        props[col.name] = selectOpt(v as string | null | undefined)
        break
    }
  }
  return props
}

/* ──────────────────────────── Notion HTTP calls ─────────────────────────── */

function authHeaders(token: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
  }
}

interface NotionResult {
  ok: boolean
  status: number
  body: string
}

async function patchDatabase(
  token: string,
  databaseId: string,
  schema: SchemaCol[],
): Promise<NotionResult> {
  const resp = await fetch(`${NOTION_BASE}/databases/${databaseId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ properties: schemaProperties(schema) }),
  })
  const text = await resp.text().catch(() => '')
  return { ok: resp.ok, status: resp.status, body: text }
}

async function createPage(
  token: string,
  databaseId: string,
  schema: SchemaCol[],
  payload: Record<string, unknown>,
  title: string,
): Promise<NotionResult> {
  const resp = await fetch(`${NOTION_BASE}/pages`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: payloadToProperties(schema, payload, title),
    }),
  })
  const text = await resp.text().catch(() => '')
  return { ok: resp.ok, status: resp.status, body: text }
}

/* Heuristic: if Notion says "property does not exist" or "validation_error"
   on a missing property, run schema-sync then retry. */
function isMissingPropertyError(status: number, body: string): boolean {
  if (status !== 400) return false
  const lower = body.toLowerCase()
  return (
    lower.includes('is not a property') ||
    lower.includes('does not exist') ||
    lower.includes('could not find property')
  )
}

/* ─────────────────────────────── Entry point ────────────────────────────── */

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  })
}

/* Write one row, auto-syncing the schema once on missing-property errors. */
async function writeRow(
  token: string,
  databaseId: string,
  schema: SchemaCol[],
  payload: Record<string, unknown>,
  title: string,
): Promise<NotionResult> {
  let r = await createPage(token, databaseId, schema, payload, title)
  if (!r.ok && isMissingPropertyError(r.status, r.body)) {
    const sync = await patchDatabase(token, databaseId, schema)
    if (!sync.ok) {
      return {
        ok: false,
        status: sync.status,
        body: `schema-sync fallback failed: ${sync.body}`,
      }
    }
    r = await createPage(token, databaseId, schema, payload, title)
  }
  return r
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405)
  }

  const token = process.env.NOTION_PAT
  const sessionDbId = process.env.NOTION_DB_ID
  const eventDbId = process.env.NOTION_EVENT_DB_ID

  if (!token || !sessionDbId) {
    return json(
      {
        error:
          'Missing NOTION_PAT or NOTION_DB_ID in server environment. Add them in Vercel Project Settings or .env.local.',
      },
      500,
    )
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (body.action === 'ping') {
    return json({
      ok: true,
      hasToken: !!token,
      hasDb: !!sessionDbId,
      hasEventDb: !!eventDbId,
    })
  }

  if (body.action === 'ensure-schema') {
    const r = await patchDatabase(token, sessionDbId, SCHEMA)
    if (!r.ok) {
      return json(
        {
          error: `Notion schema sync failed (${r.status}): ${r.body.slice(0, 400)}`,
        },
        502,
      )
    }
    return json({ ok: true, properties: SCHEMA.map((c) => c.name) })
  }

  if (body.action === 'ensure-event-schema') {
    if (!eventDbId) {
      return json(
        { error: 'NOTION_EVENT_DB_ID not configured on server.' },
        500,
      )
    }
    const r = await patchDatabase(token, eventDbId, EVENT_SCHEMA)
    if (!r.ok) {
      return json(
        {
          error: `Notion event-schema sync failed (${r.status}): ${r.body.slice(0, 400)}`,
        },
        502,
      )
    }
    return json({ ok: true, properties: EVENT_SCHEMA.map((c) => c.name) })
  }

  if (body.action === 'log') {
    if (!body.payload || typeof body.payload !== 'object') {
      return json({ error: 'payload missing or invalid' }, 400)
    }
    const r = await writeRow(
      token,
      sessionDbId,
      SCHEMA,
      body.payload as unknown as Record<string, unknown>,
      titleFromSession(body.payload),
    )
    if (!r.ok) {
      return json(
        {
          error: `Notion session log failed (${r.status}): ${r.body.slice(0, 400)}`,
        },
        502,
      )
    }
    return json({ ok: true })
  }

  if (body.action === 'event') {
    if (!eventDbId) {
      return json(
        { error: 'NOTION_EVENT_DB_ID not configured on server.' },
        500,
      )
    }
    if (!body.payload) {
      return json({ error: 'payload missing' }, 400)
    }
    const batch = Array.isArray(body.payload) ? body.payload : [body.payload]
    if (batch.length === 0) return json({ ok: true, written: 0 })

    // Notion's rate-limit is ~3 req/sec per integration. Sending the
    // batch sequentially keeps us well under that for any realistic
    // client burst (≤20 events) and surfaces errors row-by-row.
    const results: { ok: boolean; status: number; body?: string }[] = []
    for (const ev of batch) {
      const r = await writeRow(
        token,
        eventDbId,
        EVENT_SCHEMA,
        ev as unknown as Record<string, unknown>,
        titleFromEvent(ev),
      )
      results.push(r.ok ? { ok: true, status: r.status } : r)
    }
    const failed = results.filter((r) => !r.ok)
    if (failed.length > 0) {
      return json(
        {
          ok: false,
          written: results.length - failed.length,
          failed: failed.length,
          firstError: failed[0]?.body?.slice(0, 300),
        },
        502,
      )
    }
    return json({ ok: true, written: results.length })
  }

  return json({ error: 'Unknown action' }, 400)
}

export const config = {
  runtime: 'edge',
}
