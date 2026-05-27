import type { Persona } from '../../../types'
import { delay } from '../reasoning'
import type { DialogueAgent, DialogueInput } from '../types'

type Intent = 'greeting' | 'goal' | 'emotion' | 'doubt' | 'ready' | 'default'

const KEYWORDS: Record<Exclude<Intent, 'default'>, RegExp> = {
  greeting: /안녕|하이|반가|시작할게|시작하자/,
  goal: /시험|공부|운동|프로젝트|일기|자격증|목표|준비|할거|할래|하고\s*싶/,
  emotion: /힘들|지쳤|자책|못\s*했|실패|포기|불안|걱정|스트레스/,
  doubt: /모르겠|어떻게|막막|뭐부터|할\s*수\s*있을까/,
  ready: /좋아|그래|응|네|할게|준비됐|시작해/,
}

function detect(utterance: string): Intent {
  for (const [intent, re] of Object.entries(KEYWORDS)) {
    if (re.test(utterance)) return intent as Intent
  }
  return 'default'
}

const RESPONSES: Record<Intent, Record<Persona, string[]>> = {
  greeting: {
    gentle: ['반가워요! 오늘 어떤 목표를 함께 만들어볼까요?'],
    strict: ['좋습니다. 목표부터 정확히 정해봅시다.'],
  },
  goal: {
    gentle: [
      '좋은 목표예요. 함께라면 충분히 해낼 수 있어요. 언제까지 도전해볼까요?',
      '멋진 시작이에요! 그 목표, 제가 끝까지 함께 달릴게요.',
    ],
    strict: [
      '명확한 목표군요. 그럼 기간을 정합시다. 마감일이 언제죠?',
      '좋습니다. 목표를 잡았으니 바로 기간을 설정하죠.',
    ],
  },
  emotion: {
    gentle: [
      '자책하지 마세요. 못 했다고 실패는 아니잖아요. 오늘은 가장 쉬운 것부터 열어볼까요?',
      '잠깐 멈춰도 괜찮아요. 다시 페이스를 맞추면 돼요. 제가 옆에 있을게요.',
    ],
    strict: [
      '감정은 잠시 접어두죠. 지금 할 수 있는 가장 작은 한 걸음은 뭡니까?',
      '멈춘 건 지나간 일입니다. 오늘 다시 시작하면 됩니다.',
    ],
  },
  doubt: {
    gentle: [
      '막막할 땐 잘게 쪼개면 돼요. 큰 그림은 제가 같이 그려드릴게요.',
      '괜찮아요, 처음엔 다 그래요. 한 단계씩 같이 정리해봐요.',
    ],
    strict: [
      '막막함은 계획이 없을 때 옵니다. 지금부터 단계로 나눕시다.',
      '뭐부터 할지는 제가 정리합니다. 따라오기만 하면 됩니다.',
    ],
  },
  ready: {
    gentle: ['좋아요! 그럼 다음 단계로 함께 가볼까요?'],
    strict: ['좋습니다. 다음 단계로 넘어갑니다.'],
  },
  default: {
    gentle: ['그렇군요. 조금 더 이야기해줄래요? 함께 정리해볼게요.'],
    strict: ['알겠습니다. 핵심을 더 구체적으로 말해주세요.'],
  },
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export class MockDialogue implements DialogueAgent {
  async respond({ utterance, persona }: DialogueInput): Promise<string> {
    await delay(380 + Math.random() * 520)
    const intent = detect(utterance)
    return pick(RESPONSES[intent][persona])
  }
}
