/* Mock Analyzer — extracts usage / procrastination patterns from the event log.

   Heuristic and offline. The real Analyzer would summarize the long-term
   behavior log through the ReasoningEngine. */

import type { UserEvent } from '../../../types'
import { uid } from '../../util'
import { delay } from '../reasoning'
import type { AnalyzerAgent, Insight } from '../types'

/** Hour-of-day bucket for an event. */
function hour(e: UserEvent): number {
  return new Date(e.at).getHours()
}

export class MockAnalyzer implements AnalyzerAgent {
  async extractPatterns(events: UserEvent[]): Promise<Insight[]> {
    await delay(300 + Math.random() * 360)
    const insights: Insight[] = []

    const missed = events.filter((e) => e.type === 'mission_missed')
    const completed = events.filter((e) => e.type === 'mission_completed')

    // Pattern 1: three+ misses → afternoon focus drop (drives Adjuster.replan).
    if (missed.length >= 3) {
      const afternoonMisses = missed.filter((e) => {
        const h = hour(e)
        return h >= 12 && h < 18
      })
      if (afternoonMisses.length >= Math.ceil(missed.length / 2)) {
        insights.push({
          id: uid('insight'),
          kind: 'afternoon_focus_drop',
          summary: '오후 시간대 집중력 저하 패턴이 보여요.',
          recommendation: '계획을 오전 중심으로 재조정하는 것을 제안합니다.',
        })
      } else {
        insights.push({
          id: uid('insight'),
          kind: 'repeated_miss',
          summary: '미션을 반복적으로 놓치고 있어요.',
          recommendation: '하루 분량을 줄이거나 미션을 잘게 쪼개는 것을 제안합니다.',
        })
      }
    }

    // Pattern 2: a strong completion streak → momentum worth reinforcing.
    if (completed.length >= 5 && missed.length === 0) {
      insights.push({
        id: uid('insight'),
        kind: 'strong_momentum',
        summary: '미션을 빠짐없이 완료하는 좋은 흐름이에요.',
        recommendation: '통계 기반 격려로 이 흐름을 강화하세요.',
      })
    }

    // Pattern 3: opens app but rarely starts the day.
    const opens = events.filter((e) => e.type === 'app_open').length
    const starts = events.filter((e) => e.type === 'day_started').length
    if (opens >= 4 && starts / Math.max(opens, 1) < 0.4) {
      insights.push({
        id: uid('insight'),
        kind: 'entry_friction',
        summary: '앱은 열지만 시작까지 가지 못하는 경우가 많아요.',
        recommendation: '부담 감소 시작 메시지("딱 5분만")로 진입을 유도하세요.',
      })
    }

    return insights
  }
}
