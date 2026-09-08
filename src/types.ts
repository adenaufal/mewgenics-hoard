// Domain types untuk Mewgenics Hoard.
// JSON di `/public/data/` pakai format compact tuple (lihat scripts/split-dataset.mjs):
//   item:  [code, name, kind, rarity, setIdx[], flags, frame]
//   set:   [code, desc]
// Flags = bitfield: 1 = consumable, 2 = cursed (PRD §Data Model).
// Frame = icon ID; renders as `public/icons/<kind>/<frame>.png`.
// Wildcard items (cuma RuneofPerthro) punya setIdx === [-1].

export type SlotKind = 'head' | 'face' | 'neck' | 'trinket' | 'weapon'

export type Rarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'very_rare'
  | 'sidequest'
  | 'quest'
  | 'none'

export type ItemTuple = readonly [
  code: string,
  name: string,
  kind: SlotKind,
  rarity: Rarity,
  setIdx: readonly number[],
  flags: number,
  frame: number,
]

export type SetTuple = readonly [code: string, desc: string]

export const ITEM_FLAG_CONSUMABLE = 1
export const ITEM_FLAG_CURSED = 2

export type Item = {
  code: string
  name: string
  kind: SlotKind
  rarity: Rarity
  setIdx: readonly number[]
  isConsumable: boolean
  isCursed: boolean
  /** Icon ID — resolves to `public/icons/<kind>/<frame>.png`. */
  frame: number
}

export type SetDef = {
  /** Stable index into the original sets array — what `Item.setIdx` references. */
  idx: number
  code: string
  desc: string
}

export type Verdict = 'keep' | 'meh' | 'trash'

export type CatProxy = 0 | 1 | 2

export type CatSlots = Record<SlotKind, string | null>

export type Cat = {
  id: string
  name: string
  slots: CatSlots
  proxy: CatProxy
}

// v2 schema matches reference MVP localStorage payload
// (key `mewgenics_tracker_v2`). Snapshots / history are Phase 2 (PRD G5).
export type TrackerSchemaV2 = {
  schemaVersion: 2
  storage: Record<string, number>
  cats: Cat[]
  plannedSets: Record<string, boolean>
  overrides: Record<string, Verdict>
  slotMax: number
}

export type TrackerState = TrackerSchemaV2

export type VerdictResult = {
  verdict: Verdict
  reason: string
  priority: number
}

export type ActiveSetEntry = {
  set: SetDef
  pieces: number
  required: number
}

export type CatSetCalc = {
  active: ActiveSetEntry[]
  partial: ActiveSetEntry[]
}
