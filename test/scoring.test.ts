import { describe, expect, it } from 'vitest'
import { hasSecretAccess, maxPoints, questPoints, rankBonus } from '../shared/utils/scoring'

describe('questPoints', () => {
  it('gives 100 points per difficulty level, plus a bonus for the first teams', () => {
    expect(questPoints(1, 1)).toBe(150)
    expect(questPoints(1, 2)).toBe(140)
    expect(questPoints(3, 1)).toBe(450)
  })

  it('stops the bonus from the sixth team', () => {
    expect(rankBonus(5)).toBe(10)
    expect(rankBonus(6)).toBe(0)
    expect(questPoints(2, 6)).toBe(200)
    expect(questPoints(2, 40)).toBe(200)
  })
})

describe('secret quests', () => {
  it('sums the normal quests only, with and without the first bonus', () => {
    const quests = [
      { difficulty: 1, secret: false },
      { difficulty: 3, secret: false },
      { difficulty: 5, secret: true },
    ]
    expect(maxPoints(quests)).toEqual({ withoutBonus: 400, withBonus: 600 })
    expect(maxPoints([])).toEqual({ withoutBonus: 0, withBonus: 0 })
  })

  it('opens them from the threshold on', () => {
    expect(hasSecretAccess(999, 1000)).toBe(false)
    expect(hasSecretAccess(1000, 1000)).toBe(true)
    expect(hasSecretAccess(0, 0)).toBe(true)
  })
})
