import { useMemo } from 'react'

import type { Goal, Persona } from '../types'
import { timeOfDay, todayISO } from './util'

type Tod = ReturnType<typeof timeOfDay>
type Context =
  | 'kickoff'
  | 'midway'
  | 'closing'
  | 'celebrate'
  | 'idle-evening'
  | 'streak-keep'

const LINES: Record<Persona, Record<Context, Record<Tod, string[]>>> = {
  gentle: {
    kickoff: {
      morning: [
        '오늘도 같이 시작해볼까요? 첫 작업부터 가볍게 가요.',
        '커피 한 잔 같이 마시는 마음으로, 천천히 시작해요.',
      ],
      afternoon: [
        '아직 늦지 않았어요. 첫 한 가지만 같이 해봐요.',
        '오후 첫 30분만 같이 해볼까요?',
      ],
      evening: [
        '오늘 짧게라도 한 가지만 해두면 충분해요.',
        '하루를 가볍게 마무리하는 미션 하나 골라봐요.',
      ],
      night: [
        '늦은 시간이지만 잠깐만 같이 정리해봐요.',
        '오늘은 한 줄이라도 충분해요.',
      ],
    },
    midway: {
      morning: [
        '벌써 시작했네요. 그 페이스 그대로 가요.',
        '잘 하고 있어요. 다음 한 가지 같이 봐요.',
      ],
      afternoon: [
        '잘 흘러가고 있어요. 한 박자 쉬고 다음 거 갈게요.',
        '여기까지 오셨다면 끝까지 갈 수 있어요.',
      ],
      evening: [
        '오늘 흐름 좋아요. 마지막 한 가지만 같이 해요.',
        '한 발 남았네요. 가볍게 마무리해요.',
      ],
      night: [
        '거의 다 왔어요. 마지막 미션 같이 끝내요.',
        '오늘도 멀리 왔어요.',
      ],
    },
    closing: {
      morning: ['오늘 아침에 이만큼이라니, 멋져요!'],
      afternoon: ['거의 다 왔어요. 한 발만 더.'],
      evening: ['이제 한 가지만 남았어요. 같이 닫아요.'],
      night: ['마지막 한 발, 같이 가요.'],
    },
    celebrate: {
      morning: ['오늘 아침이 완벽했어요. 자랑스러워요.'],
      afternoon: ['벌써 다 끝냈네요! 남은 시간은 회복하는 거예요.'],
      evening: ['오늘 멋졌어요. 푹 쉬세요.'],
      night: ['오늘도 끝까지 함께 해주셔서 고마워요.'],
    },
    'idle-evening': {
      morning: [],
      afternoon: [],
      evening: [
        '아직 시작 전이지만, 5분만 같이 해볼까요?',
        '하루가 짧아도 한 줄은 남길 수 있어요.',
      ],
      night: [
        '오늘은 한 가지만 작게 해도 충분해요.',
        '내일을 위해 가볍게 닫아볼까요?',
      ],
    },
    'streak-keep': {
      morning: ['연속 기록 이어가요. 오늘도 가볍게 시작!'],
      afternoon: ['지금까지 이어온 페이스 그대로 가요.'],
      evening: ['오늘만 마무리하면 또 하루 추가에요.'],
      night: ['짧게라도 오늘 자취 남겨요.'],
    },
  },
  strict: {
    kickoff: {
      morning: [
        '시작 시간이에요. 첫 25분 블록 바로 들어갑니다.',
        '오늘 첫 작업, 지금 시작하세요.',
      ],
      afternoon: [
        '벌써 오후예요. 첫 작업부터 빠르게 잡으세요.',
        '10분 안에 첫 작업을 시작하세요.',
      ],
      evening: [
        '아직 0건이에요. 지금 멈추면 내일이 더 무거워져요.',
        '저녁이라도 25분 한 블록은 가능합니다.',
      ],
      night: [
        '늦었지만 핵심 한 가지는 끝내고 자세요.',
        '오늘 0건이면 페이스가 흔들립니다.',
      ],
    },
    midway: {
      morning: [
        '좋은 페이스. 다음 블록도 시간 끊어서 진행하세요.',
        '집중 흐름이 좋아요. 25분 더 갑니다.',
      ],
      afternoon: [
        '진행률 양호. 남은 작업 시간 분배해서 가세요.',
        '여기서 멈추지 마시고 다음 블록 바로 시작.',
      ],
      evening: [
        '계획 절반은 넘겼어요. 끝까지 갑니다.',
        '오늘 미션 마저 닫고 회고하세요.',
      ],
      night: [
        '남은 작업 압축해서 끝내세요.',
        '여기서 멈추면 내일 두 배입니다.',
      ],
    },
    closing: {
      morning: ['거의 닫혔습니다. 마지막 미션 정리.'],
      afternoon: ['한 발 남음. 지금 끝내고 회고하세요.'],
      evening: ['마지막 한 가지. 미루지 마세요.'],
      night: ['마지막입니다. 지금 닫으세요.'],
    },
    celebrate: {
      morning: ['아침에 완료. 이상적인 페이스입니다.'],
      afternoon: ['오늘 분량 완료. 회복에 시간 쓰세요.'],
      evening: ['목표 달성. 내일 루틴도 그대로 유지하세요.'],
      night: ['완주. 동일 페이스 내일도.'],
    },
    'idle-evening': {
      morning: [],
      afternoon: [],
      evening: [
        '시간이 빠르게 줄어들고 있어요. 지금 시작하세요.',
        '오늘 0건이면 누적 페이스가 무너집니다.',
      ],
      night: [
        '늦은 시간입니다. 핵심 한 가지만이라도.',
        '오늘 한 줄도 안 남으면 내일 부담이 커집니다.',
      ],
    },
    'streak-keep': {
      morning: ['연속 기록 중. 페이스 유지하세요.'],
      afternoon: ['연속 끊기 직전. 다음 작업 시작.'],
      evening: ['연속 유지하려면 오늘 마무리 필수.'],
      night: ['연속 지키려면 지금 한 가지라도 닫으세요.'],
    },
  },
}

function pickContext(goal: Goal): Context {
  const today = todayISO()
  const todays = goal.missions.filter((m) => m.date === today)
  const done = todays.filter((m) => m.completed).length
  const total = todays.length
  const ratio = total === 0 ? 0 : done / total
  const tod = timeOfDay()
  const streak = goal.progress.currentStreak

  if (total === 0) return streak > 0 ? 'streak-keep' : 'kickoff'
  if (ratio >= 1) return 'celebrate'
  if (ratio >= 0.66) return 'closing'
  if (done === 0) {
    if (tod === 'evening' || tod === 'night') return 'idle-evening'
    return streak > 0 ? 'streak-keep' : 'kickoff'
  }
  return 'midway'
}

export function usePacelyMessage(goal: Goal, persona: Persona): string {
  return useMemo(() => {
    const ctx = pickContext(goal)
    const tod = timeOfDay()
    const list = LINES[persona][ctx][tod]
    const lines =
      list && list.length > 0 ? list : LINES[persona].kickoff[tod]
    const seed = Math.floor(new Date().getDate() + new Date().getHours() / 3)
    return lines[seed % lines.length]
  }, [goal, persona])
}
