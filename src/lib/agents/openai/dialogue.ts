import type { Persona } from '../../../types'
import type { DialogueAgent, DialogueInput } from '../types'
import { callLLM, type ChatMessage } from './client'

const PERSONA_SYSTEM: Record<Persona, string> = {
  gentle: `너는 Pacely라는 한국어 AI 페이스메이커. 동반자형 — 부드럽고 격려하는 말투, 함께 가는 느낌. 한국어 반말체는 쓰지 말고 "~요" 체로. 한 번에 1~2 문장만, 90자 이내. 이모지는 가끔만, 과하지 않게.`,
  strict: `너는 Pacely라는 한국어 AI 페이스메이커. 코치형 — 명확하고 단호한 말투, 시간과 액션을 강조. "~합시다" / "~하세요" 체. 한 번에 1~2 문장만, 90자 이내. 이모지는 쓰지 마.`,
}

export class OpenAIDialogue implements DialogueAgent {
  async respond({ utterance, persona, context }: DialogueInput): Promise<string> {
    const messages: ChatMessage[] = [
      { role: 'system', content: PERSONA_SYSTEM[persona] },
    ]
    if (context && context.length > 0) {
      messages.push({
        role: 'system',
        content: `최근 대화 요약: ${context.slice(-3).join(' / ')}`,
      })
    }
    messages.push({ role: 'user', content: utterance })

    const text = await callLLM(messages, {
      maxTokens: 160,
      temperature: 0.8,
    })
    return text.trim().replace(/^["']|["']$/g, '')
  }
}
