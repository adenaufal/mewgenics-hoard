import {
  ITEM_FLAG_CONSUMABLE,
  ITEM_FLAG_CURSED,
  type Item,
  type ItemTuple,
  type Rarity,
  type SetDef,
  type SetTuple,
  type SlotKind,
} from '@/types'

// Rarity ranking from reference MVP — kept identical so verdict logic ports cleanly.
// `very_rare` and `quest` both top out at 5 (both treated as "too valuable").
export const RARITY_RANK: Record<Rarity, number> = {
  none: 0,
  common: 1,
  uncommon: 2,
  rare: 3,
  sidequest: 4,
  very_rare: 5,
  quest: 5,
}

export const SLOT_ORDER: readonly SlotKind[] = [
  'head',
  'face',
  'neck',
  'trinket',
  'weapon',
] as const

export const SLOT_LABELS: Record<SlotKind, string> = {
  head: 'Head',
  face: 'Face',
  neck: 'Neck',
  trinket: 'Trinket',
  weapon: 'Weapon',
}

export type Dataset = {
  items: Item[]
  sets: SetDef[]
  itemsByCode: Map<string, Item>
  setsByIdx: Map<number, SetDef>
  /** setIdx → items belonging to that set (excludes wildcard entries with idx === -1). */
  setToItems: Map<number, Item[]>
}

function expandItem(tuple: ItemTuple): Item {
  const [code, name, kind, rarity, setIdx, flags, frame] = tuple
  return {
    code,
    name,
    kind,
    rarity,
    setIdx,
    isConsumable: (flags & ITEM_FLAG_CONSUMABLE) !== 0,
    isCursed: (flags & ITEM_FLAG_CURSED) !== 0,
    frame,
  }
}

function expandSet(tuple: SetTuple, idx: number): SetDef {
  const [code, desc] = tuple
  return { idx, code, desc }
}

function buildDataset(itemTuples: ItemTuple[], setTuples: SetTuple[]): Dataset {
  const items = itemTuples.map(expandItem)
  const sets = setTuples.map(expandSet)

  const itemsByCode = new Map<string, Item>()
  for (const it of items) itemsByCode.set(it.code, it)

  const setsByIdx = new Map<number, SetDef>()
  for (const s of sets) setsByIdx.set(s.idx, s)

  const setToItems = new Map<number, Item[]>()
  for (const s of sets) setToItems.set(s.idx, [])
  for (const it of items) {
    for (const si of it.setIdx) {
      if (si < 0) continue // wildcard, not a real set membership
      const bucket = setToItems.get(si)
      if (bucket) bucket.push(it)
    }
  }

  return { items, sets, itemsByCode, setsByIdx, setToItems }
}

let datasetPromise: Promise<Dataset> | null = null

export function loadDataset(): Promise<Dataset> {
  if (datasetPromise) return datasetPromise
  datasetPromise = (async () => {
    const [itemsRes, setsRes] = await Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/items.json`),
      fetch(`${import.meta.env.BASE_URL}data/sets.json`),
    ])
    if (!itemsRes.ok) throw new Error(`items.json fetch failed (${itemsRes.status})`)
    if (!setsRes.ok) throw new Error(`sets.json fetch failed (${setsRes.status})`)
    const [itemTuples, setTuples] = (await Promise.all([
      itemsRes.json(),
      setsRes.json(),
    ])) as [ItemTuple[], SetTuple[]]
    return buildDataset(itemTuples, setTuples)
  })()
  return datasetPromise
}

// Exposed for tests so we can build a dataset from in-memory tuples
// (no need to spin up a fetch mock).
export const __test = { buildDataset, expandItem, expandSet }
