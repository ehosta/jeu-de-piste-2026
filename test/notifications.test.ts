import { describe, expect, it } from 'vitest'
import {
  MAX_NOTIFICATION_LENGTH,
  parseNotificationInput,
} from '../shared/utils/notifications'

const TEAM_ID = '0192f1a4-7c3e-7b2a-9d4e-1f2a3b4c5d6e'

describe('parseNotificationInput', () => {
  it('accepts a message for everyone, trimmed', () => {
    expect(
      parseNotificationInput({ message: '  Rendez-vous en salle de conférence !  ', audience: 'ALL', duration: 15 }),
    ).toEqual({
      ok: true,
      value: {
        message: 'Rendez-vous en salle de conférence !',
        audience: 'ALL',
        teamId: null,
        urgent: false,
        duration: 15,
      },
    })
  })

  it('keeps a message until taken down when no duration is given', () => {
    const parsed = parseNotificationInput({ message: 'Hello', audience: 'NPCS', urgent: true })
    expect(parsed.ok && parsed.value).toMatchObject({ duration: null, urgent: true })
  })

  it('only keeps the team for a team audience', () => {
    const parsed = parseNotificationInput({ message: 'Hi', audience: 'PLAYERS', teamId: TEAM_ID })
    expect(parsed.ok && parsed.value.teamId).toBeNull()

    const forTeam = parseNotificationInput({ message: 'Hi', audience: 'TEAM', teamId: TEAM_ID })
    expect(forTeam.ok && forTeam.value.teamId).toBe(TEAM_ID)
  })

  it.each([
    [{ message: '   ', audience: 'ALL' }, 'messageRequired'],
    [{ message: 'a'.repeat(MAX_NOTIFICATION_LENGTH + 1), audience: 'ALL' }, 'messageTooLong'],
    [{ message: 'Hi', audience: 'EVERYONE' }, 'invalidAudience'],
    [{ message: 'Hi', audience: 'TEAM' }, 'teamRequired'],
    [{ message: 'Hi', audience: 'TEAM', teamId: 'not-a-uuid' }, 'teamRequired'],
    [{ message: 'Hi', audience: 'ALL', duration: 7 }, 'invalidDuration'],
  ])('refuses %o (%s)', (body, issue) => {
    expect(parseNotificationInput(body)).toEqual({ ok: false, issue })
  })

  it('refuses an empty body', () => {
    expect(parseNotificationInput(undefined)).toEqual({ ok: false, issue: 'messageRequired' })
  })
})
