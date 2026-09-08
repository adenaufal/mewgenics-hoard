import { describe, it, expect } from 'vitest'
import { __test } from '@/lib/data'
import { buildEquippedMap, computeVerdict } from '@/lib/verdict'
import { calcAllActiveSets } from '@/lib/setbonus'
import type { Cat, ItemTuple, SetTuple, TrackerState } from '@/types'

const sets: SetTuple[] = [
  ['Scrap', '+1 Thorns.'],
  ['Demonic', 'Demonic effect.'],
  ['Barbed', 'Barbed effect.'],
]

const items: ItemTuple[] = [
  ['ScrapHat', 'Scrap Hat', 'head', 'common', [0], 0, 1],
  ['ScrapMask', 'Scrap Mask', 'face', 'common', [0], 0, 2],
  ['ScrapCollar', 'Scrap Collar', 'neck', 'common', [0], 0, 3],
  ['HellHat', 'Hell Hat', 'head', 'rare', [1, 2], 0, 4],
  ['HellHook', 'Hell Hook', 'weapon', 'rare', [1, 2], 0, 5],
  ['DemonRing', 'Demon Ring', 'trinket', 'rare', [1], 0, 6],
  ['Rune', 'Rune of Perthro', 'neck', 'very_rare', [-1], 0, 7],
  ['Excalibur', 'Excalibur', 'weapon', 'very_rare', [], 0, 8],
  ['Stick', 'Plain Stick', 'weapon', 'common', [], 0, 9],
  ['Crystal', 'Lucky Crystal', 'trinket', 'uncommon', [], 0, 10],
]

const data = __test.buildDataset(items, sets)

type State = Pick<TrackerState, 'storage' | 'cats' | 'plannedSets' | 'overrides'>

function makeState(s: Partial<State> = {}): State {
  return {
    storage: s.storage ?? {},
    cats: s.cats ?? [],
    plannedSets: s.plannedSets ?? {},
    overrides: s.overrides ?? {},
  }
}

function makeCat(o: Partial<Cat> = {}): Cat {
  return {
    id: 'c1',
    name: 'X',
    slots: { head: null, face: null, neck: null, trinket: null, weapon: null },
    proxy: 0,
    ...o,
  }
}

function deps(state: State) {
  return {
    state,
    data,
    equipped: buildEquippedMap(state.cats),
    activeCatSets: calcAllActiveSets(state.cats, data),
  }
}

describe('computeVerdict', () => {
  it('honors manual override', () => {
    const state = makeState({
      storage: { ScrapHat: 1 },
      overrides: { ScrapHat: 'keep' },
    })
    const v = computeVerdict('ScrapHat', deps(state))
    expect(v.verdict).toBe('keep')
    expect(v.priority).toBe(99)
  })

  it('always keeps wildcard', () => {
    const state = makeState({ storage: { Rune: 1 } })
    const v = computeVerdict('Rune', deps(state))
    expect(v.verdict).toBe('keep')
    expect(v.priority).toBe(10)
  })

  it('keeps very_rare with qty<=1', () => {
    const state = makeState({ storage: { Excalibur: 1 } })
    const v = computeVerdict('Excalibur', deps(state))
    expect(v.verdict).toBe('keep')
    expect(v.priority).toBe(9)
  })

  it('keeps standalone valuable when no sets', () => {
    const state = makeState({ storage: { Excalibur: 2 } })
    const v = computeVerdict('Excalibur', deps(state))
    // qty=2 disqualifies "too valuable" (priority 9), falls to standalone valuable (priority 8)
    expect(v.verdict).toBe('keep')
    expect(v.priority).toBe(8)
  })

  it('marks standalone uncommon as meh', () => {
    const state = makeState({ storage: { Crystal: 1 } })
    const v = computeVerdict('Crystal', deps(state))
    expect(v.verdict).toBe('meh')
    expect(v.priority).toBe(5)
  })

  it('trashes standalone common with no sets', () => {
    const state = makeState({ storage: { Stick: 1 } })
    const v = computeVerdict('Stick', deps(state))
    expect(v.verdict).toBe('trash')
    expect(v.priority).toBe(1)
  })

  it('keeps planned-set members', () => {
    const state = makeState({
      storage: { ScrapHat: 1 },
      plannedSets: { Scrap: true },
    })
    const v = computeVerdict('ScrapHat', deps(state))
    expect(v.verdict).toBe('keep')
    expect(v.priority).toBe(8)
    expect(v.reason).toMatch(/Planned/)
  })

  it('keeps when set has 3+ pieces in storage', () => {
    const state = makeState({
      storage: { ScrapHat: 1, ScrapMask: 1, ScrapCollar: 1 },
    })
    const v = computeVerdict('ScrapHat', deps(state))
    expect(v.verdict).toBe('keep')
    expect(v.priority).toBe(7)
    expect(v.reason).toMatch(/Could complete/)
  })

  it('marks partial set member as meh', () => {
    const state = makeState({ storage: { ScrapHat: 1 } })
    const v = computeVerdict('ScrapHat', deps(state))
    expect(v.verdict).toBe('meh')
    // 1 piece in storage = "Part of Scrap (1 pieces)" priority 4
    expect(v.priority).toBe(4)
  })

  it('signals no extra value when all copies already equipped on active set', () => {
    const cat = makeCat({
      slots: {
        head: 'ScrapHat',
        face: 'ScrapMask',
        neck: 'ScrapCollar',
        trinket: null,
        weapon: null,
      },
    })
    const state = makeState({
      storage: { ScrapHat: 1, ScrapMask: 1, ScrapCollar: 1 },
      cats: [cat],
    })
    const v = computeVerdict('ScrapHat', deps(state))
    // The active-set branch with equippedCount>=qty produces no reasons,
    // so verdict falls through to default trash baseline.
    expect(v.verdict).toBe('trash')
    expect(v.reason).toMatch(/already covered/i)
  })

  it('flags rare backup copy when an active set already exists on a cat', () => {
    // DemonRing is rare and only in Demonic set, so the active-set branch
    // is the only signal — no "Could complete" branch will outrank it.
    const cat = makeCat({
      slots: {
        head: 'HellHat',
        face: null,
        neck: null,
        trinket: 'DemonRing',
        weapon: 'HellHook',
      },
    })
    const state = makeState({
      storage: { DemonRing: 2, HellHat: 1, HellHook: 1 }, // 1 backup DemonRing
      cats: [cat],
    })
    const v = computeVerdict('DemonRing', deps(state))
    expect(v.verdict).toBe('meh')
    expect(v.priority).toBe(5)
    expect(v.reason).toMatch(/Backup/)
  })

  it('handles multi-set items with best priority across sets', () => {
    // HellHook is in Demonic + Barbed. Plan only Demonic.
    const state = makeState({
      storage: { HellHook: 1 },
      plannedSets: { Demonic: true },
    })
    const v = computeVerdict('HellHook', deps(state))
    expect(v.verdict).toBe('keep')
    expect(v.priority).toBe(8)
    expect(v.reason).toMatch(/Planned: Demonic/)
  })
})
