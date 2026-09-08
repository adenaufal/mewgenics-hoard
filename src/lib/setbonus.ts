import type { Dataset } from '@/lib/data'
import { SLOT_ORDER } from '@/lib/data'
import type { ActiveSetEntry, Cat, CatSetCalc } from '@/types'

// Set bonus calculation for a single cat.
//
// Wildcard handling: Rune of Perthro (setIdx === [-1]) acts as +1 toward every
// OTHER set the cat has at least one piece of. It cannot complete a set on its
// own — `Object.keys(counts)` only contains real sets the cat already touches.
//
// Item Proxy: Tinkerer (proxy=1) reduces required pieces by 1, Proxy+ (=2) by 2.
// Required = max(1, 3 - reduction). Always clamped to ≥1 so a cat can't "auto-
// activate" a set with zero pieces.
export function calcCatSets(cat: Cat, data: Dataset): CatSetCalc {
  const counts = new Map<number, number>()
  let hasWildcard = false

  for (const slot of SLOT_ORDER) {
    const code = cat.slots[slot]
    if (!code) continue
    const it = data.itemsByCode.get(code)
    if (!it) continue
    for (const si of it.setIdx) {
      if (si === -1) {
        hasWildcard = true
        continue
      }
      counts.set(si, (counts.get(si) ?? 0) + 1)
    }
  }

  if (hasWildcard) {
    for (const [si, c] of counts) counts.set(si, c + 1)
  }

  const reduction = cat.proxy
  const requiredPieces = Math.max(1, 3 - reduction)

  const active: ActiveSetEntry[] = []
  const partial: ActiveSetEntry[] = []
  for (const [si, c] of counts) {
    const set = data.setsByIdx.get(si)
    if (!set) continue
    if (c >= requiredPieces) active.push({ set, pieces: c, required: requiredPieces })
    else if (c >= 1) partial.push({ set, pieces: c, required: requiredPieces })
  }

  return { active, partial }
}

export function calcAllActiveSets(cats: Cat[], data: Dataset): Set<string> {
  const codes = new Set<string>()
  for (const cat of cats) {
    const { active } = calcCatSets(cat, data)
    for (const a of active) codes.add(a.set.code)
  }
  return codes
}
