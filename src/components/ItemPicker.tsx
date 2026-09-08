import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ItemIcon } from '@/components/ItemIcon'
import { SLOT_LABELS } from '@/lib/data'
import type { Dataset } from '@/lib/data'
import { RARITY_RANK } from '@/lib/data'
import type { Item, SlotKind } from '@/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: Dataset
  storage: Record<string, number>
  /** When set, filter items to this slot kind. */
  slotFilter?: SlotKind
  /** When true, only show items currently in storage (qty > 0). */
  ownedOnly?: boolean
  /** Allow clearing — show a "Clear slot" row at top. */
  allowClear?: boolean
  title?: string
  emptyHint?: string
  onPick: (item: Item | null) => void
}

export function ItemPicker({
  open,
  onOpenChange,
  data,
  storage,
  slotFilter,
  ownedOnly = false,
  allowClear = false,
  title = 'Pick an item',
  emptyHint = 'No matching items.',
  onPick,
}: Props) {
  const [q, setQ] = useState('')

  const items = useMemo(() => {
    let list: Item[] = data.items
    if (slotFilter) list = list.filter((i) => i.kind === slotFilter)
    if (ownedOnly) list = list.filter((i) => (storage[i.code] ?? 0) > 0)
    const ql = q.trim().toLowerCase()
    if (ql) {
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(ql) ||
          i.code.toLowerCase().includes(ql),
      )
    }
    // Sort: in-storage first, then by rarity desc, then name.
    return [...list].sort((a, b) => {
      const aOwned = (storage[a.code] ?? 0) > 0 ? 1 : 0
      const bOwned = (storage[b.code] ?? 0) > 0 ? 1 : 0
      if (aOwned !== bOwned) return bOwned - aOwned
      const ra = RARITY_RANK[a.rarity]
      const rb = RARITY_RANK[b.rarity]
      if (ra !== rb) return rb - ra
      return a.name.localeCompare(b.name)
    })
  }, [data.items, slotFilter, ownedOnly, storage, q])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Search by name or code..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="-mx-1 flex-1 overflow-auto px-1">
          {allowClear ? (
            <button
              type="button"
              onClick={() => onPick(null)}
              className="mb-1 flex w-full items-center justify-between rounded-md border border-dashed border-stone-300 px-3 py-2 text-left text-sm text-stone-500 hover:bg-stone-50"
            >
              <span>Clear slot</span>
              <span className="text-xs">none</span>
            </button>
          ) : null}
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-stone-500">
              {emptyHint}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {items.slice(0, 200).map((it) => {
                const owned = storage[it.code] ?? 0
                return (
                  <li key={it.code}>
                    <button
                      type="button"
                      onClick={() => onPick(it)}
                      className={
                        owned > 0
                          ? 'flex w-full min-h-11 items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-stone-100 focus-visible:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900'
                          : 'flex w-full min-h-11 items-center gap-3 rounded-md px-2 py-1.5 text-left opacity-60 hover:bg-stone-100 hover:opacity-100 focus-visible:bg-stone-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900'
                      }
                    >
                      <ItemIcon item={it} size="md" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                          {it.name}
                        </span>
                        <span className="truncate text-xs text-stone-500">
                          {SLOT_LABELS[it.kind]} · {it.rarity.replace('_', ' ')}
                        </span>
                      </div>
                      {owned > 0 ? (
                        <span className="ml-auto rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                          x{owned}
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
              {items.length > 200 ? (
                <li className="px-3 py-2 text-center text-xs text-stone-500">
                  Showing first 200 — refine search to see more.
                </li>
              ) : null}
            </ul>
          )}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
