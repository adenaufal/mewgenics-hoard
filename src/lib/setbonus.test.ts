import { describe, it, expect } from 'vitest'
import { __test } from '@/lib/data'
import { calcCatSets, calcAllActiveSets } from '@/lib/setbonus'
import type { Cat, ItemTuple, SetTuple } from '@/types'

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
]

const data = __test.buildDataset(items, sets)

function makeCat(overrides: Partial<Cat> = {}): Cat {
  return {
    id: 'c1',
    name: 'Test',
    slots: {
      head: null,
      face: null,
      neck: null,
      trinket: null,
      weapon: null,
    },
    proxy: 0,
    ...overrides,
  }
}

describe('calcCatSets', () => {
  it('reports active set when 3 pieces equipped', () => {
    const cat = makeCat({
      slots: { head: 'ScrapHat', face: 'ScrapMask', neck: 'ScrapCollar', trinket: null, weapon: null },
    })
    const { active, partial } = calcCatSets(cat, data)
    expect(active).toHaveLength(1)
    expect(active[0]?.set.code).toBe('Scrap')
    expect(active[0]?.pieces).toBe(3)
    expect(active[0]?.required).toBe(3)
    expect(partial).toHaveLength(0)
  })

  it('reports partial when only 1-2 pieces equipped', () => {
    const cat = makeCat({
      slots: { head: 'ScrapHat', face: 'ScrapMask', neck: null, trinket: null, weapon: null },
    })
    const { active, partial } = calcCatSets(cat, data)
    expect(active).toHaveLength(0)
    expect(partial).toHaveLength(1)
    expect(partial[0]?.set.code).toBe('Scrap')
    expect(partial[0]?.pieces).toBe(2)
  })

  it('Item Proxy reduces required pieces', () => {
    const cat = makeCat({
      proxy: 1,
      slots: { head: 'ScrapHat', face: 'ScrapMask', neck: null, trinket: null, weapon: null },
    })
    const { active } = calcCatSets(cat, data)
    expect(active).toHaveLength(1)
    expect(active[0]?.required).toBe(2)
    expect(active[0]?.pieces).toBe(2)
  })

  it('Proxy+ requires only 1 piece', () => {
    const cat = makeCat({
      proxy: 2,
      slots: { head: 'ScrapHat', face: null, neck: null, trinket: null, weapon: null },
    })
    const { active } = calcCatSets(cat, data)
    expect(active).toHaveLength(1)
    expect(active[0]?.required).toBe(1)
  })

  it('clamps required to 1 — Proxy+ never auto-activates an empty set', () => {
    const cat = makeCat({ proxy: 2 })
    const { active, partial } = calcCatSets(cat, data)
    expect(active).toHaveLength(0)
    expect(partial).toHaveLength(0)
  })

  it('wildcard (Rune of Perthro) +1s every set with at least 1 piece', () => {
    const cat = makeCat({
      slots: {
        head: 'ScrapHat',
        face: 'ScrapMask',
        neck: 'Rune', // wildcard
        trinket: null,
        weapon: null,
      },
    })
    const { active } = calcCatSets(cat, data)
    expect(active).toHaveLength(1)
    expect(active[0]?.set.code).toBe('Scrap')
    expect(active[0]?.pieces).toBe(3) // 2 real + 1 wildcard bonus
  })

  it('wildcard alone does not activate any set', () => {
    const cat = makeCat({
      slots: { head: null, face: null, neck: 'Rune', trinket: null, weapon: null },
    })
    const { active, partial } = calcCatSets(cat, data)
    expect(active).toHaveLength(0)
    expect(partial).toHaveLength(0)
  })

  it('multi-set item counts toward all its sets', () => {
    const cat = makeCat({
      slots: { head: 'HellHat', face: null, neck: null, trinket: 'DemonRing', weapon: 'HellHook' },
    })
    const { active, partial } = calcCatSets(cat, data)
    const codes = active.map((a) => a.set.code).sort()
    expect(codes).toEqual(['Demonic'])
    const partialCodes = partial.map((p) => p.set.code).sort()
    expect(partialCodes).toEqual(['Barbed'])
  })
})

describe('calcAllActiveSets', () => {
  it('aggregates active set codes across multiple cats', () => {
    const a = makeCat({
      id: 'a',
      slots: { head: 'ScrapHat', face: 'ScrapMask', neck: 'ScrapCollar', trinket: null, weapon: null },
    })
    const b = makeCat({
      id: 'b',
      slots: { head: 'HellHat', face: null, neck: null, trinket: 'DemonRing', weapon: 'HellHook' },
    })
    const codes = calcAllActiveSets([a, b], data)
    expect(codes).toEqual(new Set(['Scrap', 'Demonic']))
  })
})
