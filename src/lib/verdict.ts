import type { Dataset } from '@/lib/data'
import { RARITY_RANK, SLOT_ORDER } from '@/lib/data'
import type { Cat, TrackerState, Verdict, VerdictResult } from '@/types'

// Verdict logic ported from reference_mvp.html (preserve behavior).
// Priority order roughly follows PRD §"Verdict Logic":
//   99 manual override
//   10 wildcard (Rune of Perthro)
//    9 very_rare/quest with qty<=1
//    8 standalone valuable rarity OR planned-set keep
//    7 set could be completed (≥3 storage pieces of same set)
//    5 backup for actively-equipped set OR standalone uncommon
//    4 partial set member (≥1 storage piece of same set)
//    3 partial set member (no storage piece)
//    2 set already covered / lowest "trash" baseline
//    1 not part of any set, low rarity
// Note: storageInSet (priority 7 path) sums **qty across the set's items**,
// matching the MVP. PRD wording mentions "3+ unique" but MVP code is the
// source of truth; we keep MVP behavior to preserve verdicts under existing
// data.

type VerdictDeps = {
  state: Pick<
    TrackerState,
    'storage' | 'cats' | 'plannedSets' | 'overrides'
  >
  data: Dataset
  /** Cached map of itemCode → equipped count across all cats. */
  equipped: Map<string, number>
  /** Cached set codes that are active on at least one cat. */
  activeCatSets: Set<string>
}

export function buildEquippedMap(cats: Cat[]): Map<string, number> {
  const equipped = new Map<string, number>()
  for (const cat of cats) {
    for (const slot of SLOT_ORDER) {
      const code = cat.slots[slot]
      if (!code) continue
      equipped.set(code, (equipped.get(code) ?? 0) + 1)
    }
  }
  return equipped
}

export function computeVerdict(
  itemCode: string,
  deps: VerdictDeps,
): VerdictResult {
  const { state, data, equipped, activeCatSets } = deps

  const override = state.overrides[itemCode]
  if (override) {
    return { verdict: override, reason: 'Manual override', priority: 99 }
  }

  const it = data.itemsByCode.get(itemCode)
  if (!it) return { verdict: 'meh', reason: 'Unknown item', priority: 0 }

  const qty = state.storage[itemCode] ?? 0
  const equippedCount = equipped.get(itemCode) ?? 0

  // Wildcard — Rune of Perthro and any future entries with -1 setIdx.
  if (it.setIdx.includes(-1)) {
    return {
      verdict: 'keep',
      reason: 'Wildcard item — counts for any set',
      priority: 10,
    }
  }

  const rRank = RARITY_RANK[it.rarity]
  if (rRank >= 4 && qty <= 1) {
    const label = it.rarity.replace('_', ' ')
    return {
      verdict: 'keep',
      reason: `${label} — too valuable to trash`,
      priority: 9,
    }
  }

  const sets = it.setIdx.filter((s) => s >= 0)
  if (sets.length === 0) {
    if (rRank >= 4)
      return { verdict: 'keep', reason: 'Standalone valuable item', priority: 8 }
    if (rRank >= 2)
      return {
        verdict: 'meh',
        reason: 'Standalone uncommon — situational',
        priority: 5,
      }
    return {
      verdict: 'trash',
      reason: 'Not part of any set, low rarity',
      priority: 1,
    }
  }

  const reasons: string[] = []
  let bestVerdict: Verdict = 'trash'
  let bestPriority = 2

  for (const si of sets) {
    const set = data.setsByIdx.get(si)
    if (!set) continue
    const isPlanned = state.plannedSets[set.code] === true
    const isActiveOnCat = activeCatSets.has(set.code)

    if (isActiveOnCat) {
      if (equippedCount >= qty) {
        // every copy already on a cat — no extra signal
        continue
      }
      if (rRank >= 3) {
        reasons.push(`Backup for ${set.code} set`)
        if (bestPriority < 5) {
          bestVerdict = 'meh'
          bestPriority = 5
        }
      } else {
        reasons.push(`${set.code} set already equipped`)
      }
    } else if (isPlanned) {
      reasons.push(`Planned: ${set.code} set`)
      bestVerdict = 'keep'
      bestPriority = 8
    } else {
      let storageInSet = 0
      const members = data.setToItems.get(si) ?? []
      for (const m of members) storageInSet += state.storage[m.code] ?? 0
      if (storageInSet >= 3) {
        reasons.push(`Could complete ${set.code} (${storageInSet}/3+ in storage)`)
        if (bestPriority < 7) {
          bestVerdict = 'keep'
          bestPriority = 7
        }
      } else if (storageInSet >= 1) {
        reasons.push(`Part of ${set.code} (${storageInSet} pieces)`)
        if (bestPriority < 4) {
          bestVerdict = 'meh'
          bestPriority = 4
        }
      } else {
        reasons.push(`Part of ${set.code}`)
        if (bestPriority < 3) {
          bestVerdict = 'meh'
          bestPriority = 3
        }
      }
    }
  }

  if (reasons.length === 0) reasons.push('Set already covered')
  return { verdict: bestVerdict, reason: reasons.join(' · '), priority: bestPriority }
}

export type { VerdictDeps }
