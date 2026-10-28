import { describe, expect, it } from 'vitest'
import { renderQrCodeSvg } from '../server/utils/qrcode'
import { detectImageExtension, isPhotoKey } from '../server/utils/photo'
import {
  canSubmitPhoto,
  canWithdrawPhoto,
  getAllowedQuestActions,
  isQuestAction,
  QUEST_ACTION_RESULTS,
} from '../shared/utils/quest-actions'
import { isUuid } from '../shared/utils/uuid'
import { parseIntraLogin } from '../shared/utils/intra-login'

describe('isUuid', () => {
  it('accepts a team qrToken', () => {
    expect(isUuid(crypto.randomUUID())).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isUuid('not-a-token')).toBe(false)
    expect(isUuid(42)).toBe(false)
    expect(isUuid(undefined)).toBe(false)
  })
})

describe('renderQrCodeSvg', () => {
  it('renders an svg', async () => {
    const svg = await renderQrCodeSvg(crypto.randomUUID())

    expect(svg).toMatch(/^<svg[\s\S]*<\/svg>\s*$/)
  })
})

describe('getAllowedQuestActions', () => {
  it('lets the NPC give a hidden quest', () => {
    expect(getAllowedQuestActions('HIDDEN')).toEqual(['GIVE'])
  })

  it('lets the NPC review a submitted photo', () => {
    expect(getAllowedQuestActions('SUBMITTED')).toEqual(['VALIDATE', 'REJECT'])
  })

  it('allows nothing while waiting for the team or once locked', () => {
    expect(getAllowedQuestActions('GIVEN')).toEqual([])
    expect(getAllowedQuestActions('REJECTED')).toEqual([])
    expect(getAllowedQuestActions('VALIDATED')).toEqual([])
  })
})

describe('QUEST_ACTION_RESULTS', () => {
  it('moves a quest to the status matching the action', () => {
    expect(QUEST_ACTION_RESULTS.GIVE.status).toBe('GIVEN')
    expect(QUEST_ACTION_RESULTS.VALIDATE.status).toBe('VALIDATED')
    expect(QUEST_ACTION_RESULTS.REJECT.status).toBe('REJECTED')
  })

  it('never leads to a status that allows the same action again', () => {
    for (const [action, { status }] of Object.entries(QUEST_ACTION_RESULTS)) {
      expect(getAllowedQuestActions(status)).not.toContain(action)
    }
  })
})

describe('isQuestAction', () => {
  it('accepts known actions only', () => {
    expect(isQuestAction('GIVE')).toBe(true)
    expect(isQuestAction('DELETE')).toBe(false)
    expect(isQuestAction('toString')).toBe(false)
    expect(isQuestAction(undefined)).toBe(false)
  })
})

describe('parseIntraLogin', () => {
  it('normalizes a typed login', () => {
    expect(parseIntraLogin('  EHosta ')).toBe('ehosta')
    expect(parseIntraLogin('jean-luc')).toBe('jean-luc')
  })

  it('rejects anything that is not a 42 login', () => {
    expect(parseIntraLogin('')).toBeNull()
    expect(parseIntraLogin('jean_luc')).toBeNull()
    expect(parseIntraLogin('a b')).toBeNull()
    expect(parseIntraLogin(42)).toBeNull()
  })
})

describe('canSubmitPhoto', () => {
  it('lets a team send its photo once given the quest, or after a rejection', () => {
    expect(canSubmitPhoto('GIVEN')).toBe(true)
    expect(canSubmitPhoto('REJECTED')).toBe(true)
  })

  it('allows a single photo under review at a time', () => {
    expect(canSubmitPhoto('SUBMITTED')).toBe(false)
  })

  it('locks the photo once validated, and before the quest is given', () => {
    expect(canSubmitPhoto('VALIDATED')).toBe(false)
    expect(canSubmitPhoto('HIDDEN')).toBe(false)
  })
})

describe('canWithdrawPhoto', () => {
  it('only withdraws a photo waiting for the NPC', () => {
    expect(canWithdrawPhoto('SUBMITTED')).toBe(true)

    for (const status of ['HIDDEN', 'GIVEN', 'REJECTED', 'VALIDATED'] as const) {
      expect(canWithdrawPhoto(status)).toBe(false)
    }
  })
})

describe('detectImageExtension', () => {
  it('recognizes images from their first bytes', () => {
    expect(detectImageExtension(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg')
    expect(detectImageExtension(Buffer.from('89504e470d0a1a0a', 'hex'))).toBe('png')
    expect(detectImageExtension(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('webp')
  })

  it('rejects anything else', () => {
    expect(detectImageExtension(Buffer.from('<svg></svg>'))).toBeNull()
    expect(detectImageExtension(Buffer.alloc(0))).toBeNull()
  })
})

describe('isPhotoKey', () => {
  it('only accepts keys generated for a team quest', () => {
    expect(isPhotoKey(`${crypto.randomUUID()}-1730000000000.jpg`)).toBe(true)
    expect(isPhotoKey('../../.env')).toBe(false)
    expect(isPhotoKey(`${crypto.randomUUID()}-1.svg`)).toBe(false)
  })
})
