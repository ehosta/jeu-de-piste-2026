import { describe, expect, it } from 'vitest'
import { parseAdminPatch, parseAdminPatchText } from '../shared/utils/admin-patch'

function issues(input: unknown) {
  const parsed = parseAdminPatch(input)
  return parsed.ok ? [] : parsed.issues
}

describe('parseAdminPatch', () => {
  it('accepts a full document', () => {
    const parsed = parseAdminPatch({
      wipe: ['progress'],
      game: { paused: true, pauseMessage: 'Pause goûter' },
      teams: [
        { name: 'Les Raclettes', members: ['JDoe', ' asmith '] },
        { name: 'Ancien', rename: 'Nouveau', newQrCode: true },
        { name: 'Vieux', $delete: true },
      ],
      users: [
        { login: 'ckent', role: 'PLAYER', team: 'Les Raclettes' },
        { login: 'pparker', team: null },
        { login: 'old', $delete: true },
      ],
      npcs: [
        {
          login: 'dprince',
          name: 'Sir Claudius',
          lore: '',
          quests: [{ key: 'cantine', label: 'J\'ai faim', answer: 'Cantine' }],
        },
      ],
      quests: [{ key: 'cafe', npcs: ['dprince'], label: 'Café ?', answer: 'Machines' }],
      progress: [{ team: 'Les Raclettes', quest: 'cantine', status: 'GIVEN' }],
    })

    expect(parsed.ok).toBe(true)

    if (parsed.ok) {
      // Logins are normalized like the ones 42 sends back.
      expect(parsed.patch.teams?.[0]).toEqual({
        name: 'Les Raclettes',
        members: ['jdoe', 'asmith'],
      })
      expect(parsed.patch.users?.[1]).toEqual({ login: 'pparker', team: null })
    }
  })

  it('accepts an empty document', () => {
    expect(parseAdminPatch({}).ok).toBe(true)
  })

  it('rejects anything but an object', () => {
    expect(issues([])).toHaveLength(1)
    expect(issues('teams')).toHaveLength(1)
  })

  it('reports every problem with its path', () => {
    expect(
      issues({
        teamz: [],
        users: [{ login: 'a b' }, { login: 'ok', role: 'BOSS' }],
        progress: [{ team: 'X', quest: 'Pas Une Clé', status: 'DONE' }],
      }).map((issue) => issue.path),
    ).toEqual([
      'teamz',
      'users[0].login',
      'users[1].role',
      'progress[0].quest',
      'progress[0].status',
    ])
  })

  it('rejects unknown fields, to catch typos', () => {
    expect(issues({ teams: [{ name: 'A', member: ['x'] }] })[0]?.path).toBe(
      'teams[0].member',
    )
  })

  it('only accepts $delete: true on its own', () => {
    expect(issues({ users: [{ login: 'a', $delete: false }] })[0]?.path).toBe(
      'users[0].$delete',
    )
    expect(
      issues({ users: [{ login: 'a', $delete: true, role: 'ADMIN' }] })[0]?.path,
    ).toBe('users[0].role')
  })

  it('rejects an entry listed twice', () => {
    expect(issues({ teams: [{ name: 'A' }, { name: 'A' }] })[0]?.path).toBe(
      'teams[1]',
    )
    expect(
      issues({
        npcs: [{ login: 'a', name: 'A', quests: [{ key: 'q' }, { key: 'q' }] }],
      })[0]?.path,
    ).toBe('npcs[0].quests[1]')
  })

  it('lets a quest be shared between NPCs', () => {
    expect(
      issues({
        npcs: [
          { login: 'a', name: 'A', quests: [{ key: 'q', label: 'l', answer: 'r' }] },
          { login: 'b', name: 'B', quests: [{ key: 'q' }] },
        ],
        quests: [{ key: 'q', npcs: ['a', 'b'] }],
      }),
    ).toEqual([])
    expect(issues({ quests: [{ key: 'q', npcs: [] }] })[0]?.path).toBe('quests[0].npcs')
  })

  it('rejects unknown wipe targets', () => {
    expect(issues({ wipe: ['admins'] })[0]?.path).toBe('wipe[0]')
  })
})

describe('parseAdminPatchText', () => {
  it('reports invalid JSON', () => {
    const parsed = parseAdminPatchText('{ "teams": [ }')

    expect(parsed.ok).toBe(false)
    expect(parsed.ok ? '' : parsed.issues[0]?.code).toBe('invalidJson')
  })
})
