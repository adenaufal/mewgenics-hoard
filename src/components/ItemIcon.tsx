import { cn } from '@/lib/utils'
import type { Item, Rarity, SlotKind } from '@/types'

// Slot tint = inner background, picked to mirror the reference MVP's color
// system (head=purple, face=pink, neck=blue, trinket=amber, weapon=emerald).
// Rarity ring = outer ring, mirrors the game's gold/silver/bronze corner ring.
//   common  → no ring
//   uncommon → bronze
//   rare → silver
//   sidequest → orange
//   very_rare / quest → gold
const slotBg: Record<SlotKind, string> = {
  head: 'bg-purple-100',
  face: 'bg-pink-100',
  neck: 'bg-blue-100',
  trinket: 'bg-amber-100',
  weapon: 'bg-emerald-100',
}

const rarityRing: Record<Rarity, string> = {
  common: 'ring-1 ring-stone-300',
  uncommon: 'ring-2 ring-amber-700/70', // bronze
  rare: 'ring-2 ring-stone-400', // silver
  sidequest: 'ring-2 ring-orange-500',
  very_rare: 'ring-2 ring-yellow-500', // gold
  quest: 'ring-2 ring-yellow-500',
  none: 'ring-1 ring-stone-300',
}

const sizeClass = {
  xs: 'size-6',
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-12',
  xl: 'size-14',
} as const

export type ItemIconSize = keyof typeof sizeClass

export function iconUrl(item: Pick<Item, 'kind' | 'frame'>): string {
  const base = import.meta.env.BASE_URL
  return `${base}icons/${item.kind}/${item.frame}.png`
}

export function ItemIcon({
  item,
  size = 'md',
  className,
}: {
  item: Item
  size?: ItemIconSize
  className?: string
}) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md',
        sizeClass[size],
        slotBg[item.kind],
        rarityRing[item.rarity],
        className,
      )}
      aria-hidden
    >
      <img
        src={iconUrl(item)}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain"
      />
      {item.isCursed ? (
        <span
          className="absolute right-0 top-0 size-2 rounded-full border border-white bg-violet-600"
          title="Cursed"
        />
      ) : null}
      {item.isConsumable ? (
        <span
          className="absolute bottom-0 left-0 size-2 rounded-full border border-white bg-stone-700"
          title="Consumable"
        />
      ) : null}
    </span>
  )
}
