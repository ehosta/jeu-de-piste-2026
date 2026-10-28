import { describe, expect, it } from 'vitest'
import { questPoints, rankBonus } from '../shared/utils/scoring'

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
