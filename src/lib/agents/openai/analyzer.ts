/* Real Analyzer — extracts behavioural insights from the user's event log.

   We pre-aggregate the events into a compact summary before sending so the
   prompt stays small even after weeks of usage. */

import type { UserEvent } from '../../../types'
import { uid } from '../../util'
import type { AnalyzerAgent, Insight } from '../types'
import { callLLM, parseJsonResponse, type ChatMessage } from './client'

interface RawInsights {
  insights: { kind: string; summary: string; recommendation: string }[]
}

function summarizeEvents(events: UserEvent[]): string {
  const byType: Record<string, number> = {}
  const hourHistogram: Record<number, number> = {}
  for (const e of events) {
    byType[e.type] = (byType[e.type] ?? 0) + 1
    if (e.type === 'mission_missed' || e.type === 'mission_completed') {
      const h = new Date(e.at).getHours()
      hourHistogram[h] = (hourHistogram[h] ?? 0) + 1
    }
  }
  const histLine = Object.entries(hourHistogram)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([h, n]) => `${h}시:${n}`)
    .join(', ')

  return `이벤트 개수 (최근 ${events.length}건)
${Object.entries(byType)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}

시간대별 미션 활동:
${histLine || '(데이터 부족)'}`
}

export class OpenAIAnalyzer implements AnalyzerAgent {
  async extractPatterns(events: UserEvent[]): Promise<Insight[]> {
    if (events.length < 5) return []

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `너는 Pacely 분석기. 사용자 이벤트 요약을 보고 행동 패턴(미루기 / 슬럼프 시간대 / 진입 부담 / 강한 모멘텀 등)을 0~3개 뽑아내. JSON만:
{"insights":[{"kind":"snake_case_key","summary":"한 줄 요약","recommendation":"권장 조치 한 줄"}, ...]}

패턴이 없으면 빈 배열 반환. kind 예시: afternoon_focus_drop, repeated_miss, strong_momentum, entry_friction.`,
      },
      { role: 'user', content: summarizeEvents(events) },
    ]

    try {
      const raw = await callLLM(messages, {
        responseFormat: 'json',
        maxTokens: 600,
        temperature: 0.4,
      })
      const parsed = parseJsonResponse<RawInsights>(raw)
      return (parsed.insights ?? []).slice(0, 3).map((i) => ({
        id: uid('insight'),
        kind: i.kind || 'pattern',
        summary: i.summary,
        recommendation: i.recommendation,
      }))
    } catch (err) {
      console.warn('[OpenAIAnalyzer] LLM call failed', err)
      return []
    }
  }
}
