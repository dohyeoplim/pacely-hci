/* Small shared helpers. */

import type { ISODate } from '../types'

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function todayISO(): ISODate {
  return toISO(new Date())
}

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10)
}

export function fromISO(s: ISODate): Date {
  return new Date(`${s}T00:00:00`)
}

/** Whole-day difference, end - start. */
export function daysBetween(start: ISODate, end: ISODate): number {
  const ms = fromISO(end).getTime() - fromISO(start).getTime()
  return Math.round(ms / 86_400_000)
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** Days remaining until `end`, counting from today. D-day = 0. */
export function dDay(end: ISODate): number {
  return daysBetween(todayISO(), end)
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function formatHours(h: number): string {
  if (Number.isInteger(h)) return `${h}시간`
  return `${h.toFixed(1)}시간`
}

/** Time-of-day bucket — drives greeting + some context triggers. */
export function timeOfDay(d = new Date()): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = d.getHours()
  if (h < 6) return 'night'
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}
