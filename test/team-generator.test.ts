import { describe, expect, it } from 'vitest'
import { splitIntoTeams, teamCount } from '../shared/utils/team-generator'
import { randomTeamName, randomTeamNames } from '../shared/utils/team-names'

const players = (count: number) => Array.from({ length: count }, (_, index) => `p${index}`)

describe('splitIntoTeams', () => {
  it('keeps every player exactly once', () => {
    const teams = splitIntoTeams(players(94), 3, 'atMost')
    expect(teams.flat().sort()).toEqual(players(94).sort())
  })

  it('never goes over the size in "atMost" mode', () => {
    const sizes = splitIntoTeams(players(94), 3, 'atMost').map((team) => team.length)
    expect(sizes).toHaveLength(32)
    expect(Math.max(...sizes)).toBe(3)
    expect(Math.min(...sizes)).toBe(2)
  })

  it('never goes under the size in "atLeast" mode', () => {
    const sizes = splitIntoTeams(players(94), 3, 'atLeast').map((team) => team.length)
    expect(sizes).toHaveLength(31)
    expect(Math.min(...sizes)).toBe(3)
    expect(Math.max(...sizes)).toBe(4)
  })

  it('makes a single team when there are few players', () => {
    expect(teamCount(2, 3, 'atLeast')).toBe(1)
    expect(teamCount(0, 3, 'atMost')).toBe(0)
    expect(splitIntoTeams([], 3, 'atMost')).toEqual([])
  })
})

describe('randomTeamName', () => {
  it('makes French adjectives agree with the noun', () => {
    // First noun (Mages, masculine), first adjective.
    expect(randomTeamName('fr', () => 0)).toBe('Les Mages Segfaultés')
    // Second noun (Sorcières, feminine), then first adjective.
    const values = [0.04, 0]
    expect(randomTeamName('fr', () => values.shift()!)).toBe('Les Sorcières Segfaultées')
  })

  it('names teams in English', () => {
    expect(randomTeamName('en', () => 0)).toBe('The Segfaulted Mages')
  })

  it('never repeats a name or reuses a taken one', () => {
    const names = randomTeamNames(40, 'fr', ['Les Mages Segfaultés'], () => 0)
    const lower = names.map((name) => name.toLowerCase())
    expect(new Set(lower).size).toBe(40)
    expect(lower).not.toContain('les mages segfaultés')
  })
})
