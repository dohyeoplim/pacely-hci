import type { Experiment } from '../types'

export const SURVEY_URL = 'https://forms.gle/qTFTkRV6ZWeWhFuB7'

export const DEFAULT_EXPERIMENT: Experiment = {
  participantId: '',
  group: null,
  personaOrder: null,
  rewardEnabled: true,
}

export function isResearchMode(e: Experiment): boolean {
  return e.participantId.trim().length > 0
}
