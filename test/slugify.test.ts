import { describe, expect, it } from 'vitest'
import { slugify, uniqueQuestKey } from '../app/utils/slugify'

describe('uniqueQuestKey', () => {
  it('derives the key from the riddle', () => {
    expect(slugify('La cantine à 8 €')).toBe('la-cantine-a-8')
    expect(uniqueQuestKey('La cantine', [])).toBe('la-cantine')
  })

  it('never reuses a key, so a new quest never overwrites another', () => {
    expect(uniqueQuestKey('La cantine', ['la-cantine', 'la-cantine-2'])).toBe(
      'la-cantine-3',
    )
    expect(uniqueQuestKey('🍕', ['quete'])).toBe('quete-2')
  })
})
