/* Shared constants for the HCI study (LAB1/LAB2/LAB3 + Field Study). */

import type { Experiment } from '../types'

/** Final post-use survey shown to research participants. */
export const SURVEY_URL = 'https://forms.gle/qTFTkRV6ZWeWhFuB7'

export const DEFAULT_EXPERIMENT: Experiment = {
  participantId: '',
  group: null,
  lab1Order: null,
  lab2Condition: null,
  rewardEnabled: true,
}

/** A participant is "in the study" once an ID has been entered. */
export function isResearchMode(e: Experiment): boolean {
  return e.participantId.trim().length > 0
}
