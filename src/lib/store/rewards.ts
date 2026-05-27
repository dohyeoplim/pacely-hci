import type {
  Goal,
  GoalCategory,
  PacelyAvatar,
  Reward,
} from '../../types'
import { addDays, todayISO, uid } from '../util'

interface PartnerReward {
  partnerName: string
  emoji: string
  title: string
  value: string
}

const PARTNER_REWARDS: Record<GoalCategory, PartnerReward[]> = {
  exam: [
    {
      partnerName: '스타벅스',
      emoji: '☕',
      title: '아메리카노 1잔',
      value: 'TALL · 4,500원',
    },
    {
      partnerName: '교보문고',
      emoji: '📚',
      title: '도서 10% 할인',
      value: '전 분야 적용',
    },
  ],
  project: [
    {
      partnerName: 'Figma',
      emoji: '🧰',
      title: 'Pro 플랜 1개월',
      value: '$15 상당',
    },
    {
      partnerName: '카페 도렐',
      emoji: '🥐',
      title: '디저트 + 음료 세트',
      value: '12,000원 상당',
    },
  ],
  workout: [
    {
      partnerName: '나이키',
      emoji: '👟',
      title: '런닝화 15% 할인',
      value: '신상품 제외',
    },
    {
      partnerName: '바디프로필 스튜디오',
      emoji: '📸',
      title: '촬영 1회 할인',
      value: '30,000원 할인',
    },
  ],
  diary: [
    {
      partnerName: '모나미',
      emoji: '✏️',
      title: '문구 세트 쿠폰',
      value: '15,000원 상당',
    },
    {
      partnerName: '핫트랙스',
      emoji: '📓',
      title: '노트 1권',
      value: '베스트셀러',
    },
  ],
  custom: [
    {
      partnerName: 'CGV',
      emoji: '🎬',
      title: '영화 1편',
      value: '주중 2D',
    },
    {
      partnerName: '배달의민족',
      emoji: '🍕',
      title: '5,000원 쿠폰',
      value: '주문 금액 무관',
    },
  ],
}

const CATEGORY_TRAITS: Record<GoalCategory, string[]> = {
  exam: ['집중력', '꾸준함', '복습력'],
  project: ['실행력', '창의성', '몰입력'],
  workout: ['체력', '의지력', '루틴'],
  diary: ['성찰', '습관', '기록력'],
  custom: ['도전', '용기'],
}

export function rewardsForGoal(goal: Goal): Reward[] {
  const partners = PARTNER_REWARDS[goal.category]
  const expiry = addDays(todayISO(), 30)
  const now = Date.now()
  return partners.map((p) => ({
    id: uid('rwd'),
    sourceGoalId: goal.id,
    partnerName: p.partnerName,
    emoji: p.emoji,
    title: p.title,
    value: p.value,
    category: goal.category,
    redeemed: false,
    expiryDate: expiry,
    createdAt: now,
  }))
}

export function levelUpAvatar(
  current: PacelyAvatar,
  goal: Goal,
): PacelyAvatar {
  const pool = CATEGORY_TRAITS[goal.category]
  const next = current.traits.includes(pool[0])
    ? pool.find((t) => !current.traits.includes(t)) ?? pool[0]
    : pool[0]
  return {
    level: current.level + 1,
    accumulatedSessions: current.accumulatedSessions + 1,
    traits: Array.from(new Set([...current.traits, next])).slice(0, 6),
    themeCategory: goal.category,
  }
}

export function initialAvatar(): PacelyAvatar {
  return {
    level: 1,
    accumulatedSessions: 0,
    traits: [],
    themeCategory: 'custom',
  }
}
