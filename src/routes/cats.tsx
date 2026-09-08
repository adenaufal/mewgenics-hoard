import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ItemPicker } from '@/components/ItemPicker'
import { ItemIcon } from '@/components/ItemIcon'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useDataset } from '@/lib/useDataset'
import { useTracker } from '@/stores/tracker'
import { SLOT_LABELS, SLOT_ORDER } from '@/lib/data'
import { calcCatSets } from '@/lib/setbonus'
import type { Cat, CatProxy, SlotKind } from '@/types'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/cats')({
  component: CatsPage,
})

const slotChip: Record<SlotKind, string> = {
  head: 'border-purple-300 bg-purple-50',
  face: 'border-pink-300 bg-pink-50',
  neck: 'border-blue-300 bg-blue-50',
  trinket: 'border-amber-300 bg-amber-50',
  weapon: 'border-emerald-300 bg-emerald-50',
}

function CatsPage() {
  const ds = useDataset()
  const cats = useTracker((s) => s.cats)
  const storage = useTracker((s) => s.storage)
  const addCat = useTracker((s) => s.addCat)
  const removeCat = useTracker((s) => s.removeCat)

  const [confirmCat, setConfirmCat] = useState<Cat | null>(null)

  const data = ds.status === 'ready' ? ds.data : null

  if (ds.status === 'loading')
    return (
      <div className="h-32 animate-pulse rounded-md bg-stone-200" />
    )
  if (ds.status === 'error')
    return (
      <p className="text-sm text-rose-700">
        Failed to load dataset: {ds.error.message}
      </p>
    )
  if (!data) return null

  return (
    <section className="flex flex-col gap-3">
      <h2 className="sr-only">Cats</h2>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => {
            addCat()
            toast.success('Cat added')
          }}
        >
          + Add cat
        </Button>
        <span className="text-xs text-stone-500">
          {cats.length} cat{cats.length === 1 ? '' : 's'}
        </span>
      </div>

      {cats.length === 0 ? (
        <div className="rounded-md border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-600">
          No cats yet. Add a cat to plan loadouts and check active set bonuses.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cats.map((cat) => (
            <CatCard
              key={cat.id}
              cat={cat}
              data={data}
              storage={storage}
              onRemove={() => setConfirmCat(cat)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmCat !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmCat(null)
        }}
        title={confirmCat ? `Remove ${confirmCat.name}?` : 'Remove cat?'}
        description="This unequips all slots and removes the cat from active set tracking."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (confirmCat) {
            removeCat(confirmCat.id)
            toast(`Removed ${confirmCat.name}`)
            setConfirmCat(null)
          }
        }}
      />
    </section>
  )
}

function CatCard({
  cat,
  data,
  storage,
  onRemove,
}: {
  cat: Cat
  data: NonNullable<ReturnType<typeof useDataset>['data']>
  storage: Record<string, number>
  onRemove: () => void
}) {
  const renameCat = useTracker((s) => s.renameCat)
  const equipSlot = useTracker((s) => s.equipSlot)
  const setProxy = useTracker((s) => s.setProxy)

  const [pickerSlot, setPickerSlot] = useState<SlotKind | null>(null)

  const calc = useMemo(() => calcCatSets(cat, data), [cat, data])

  return (
    <Card className="gap-3 py-4">
      <CardContent className="flex flex-col gap-3 px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Input
            className="min-w-0 flex-1 font-semibold sm:max-w-56"
            value={cat.name}
            onChange={(e) => renameCat(cat.id, e.target.value)}
            aria-label="Cat name"
          />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-stone-600">
              <span>Item Proxy</span>
              <Select
                value={String(cat.proxy)}
                onValueChange={(v) => setProxy(cat.id, Number(v) as CatProxy)}
              >
                <SelectTrigger className="h-9 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None (3 pieces)</SelectItem>
                  <SelectItem value="1">Tinkerer (2)</SelectItem>
                  <SelectItem value="2">Proxy+ (1)</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <div className="ml-auto sm:ml-0" />
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-stone-500 hover:text-rose-600"
              onClick={onRemove}
              aria-label="Remove cat"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {SLOT_ORDER.map((slot) => {
            const code = cat.slots[slot]
            const item = code ? data.itemsByCode.get(code) : null
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setPickerSlot(slot)}
                aria-label={`${SLOT_LABELS[slot]} slot${item ? `: ${item.name}` : ' (empty)'}`}
                className={cn(
                  'flex min-h-16 items-center gap-2 rounded-md border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900',
                  item
                    ? cn('border-solid', slotChip[slot])
                    : 'border-dashed border-stone-300 bg-stone-50 hover:bg-stone-100',
                )}
              >
                {item ? (
                  <ItemIcon item={item} size="md" />
                ) : (
                  <span className="grid size-10 shrink-0 place-items-center rounded-md border border-dashed border-stone-300 text-[10px] uppercase text-stone-400">
                    +
                  </span>
                )}
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wide text-stone-500">
                    {SLOT_LABELS[slot]}
                  </span>
                  {item ? (
                    <span className="truncate text-xs font-medium leading-tight">
                      {item.name}
                    </span>
                  ) : (
                    <span className="text-xs italic text-stone-400">empty</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {calc.active.length === 0 && calc.partial.length === 0 ? (
          <p className="text-xs italic text-stone-500">
            No set bonuses active. Equip 3 pieces of the same set (or use Item
            Proxy + Rune of Perthro to lower the threshold).
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {calc.active.map((a) => (
              <div
                key={`a-${a.set.idx}`}
                className="rounded-md border-l-4 border-l-emerald-600 bg-emerald-50 px-3 py-2"
              >
                <div className="text-xs font-semibold text-emerald-900">
                  {a.set.code} · {a.pieces}/{a.required}
                </div>
                <div className="whitespace-pre-wrap text-xs text-emerald-800/80">
                  {a.set.desc}
                </div>
              </div>
            ))}
            {calc.partial.map((p) => (
              <div
                key={`p-${p.set.idx}`}
                className="rounded-md border-l-4 border-l-amber-500 bg-amber-50 px-3 py-2"
              >
                <div className="text-xs font-semibold text-amber-900">
                  {p.set.code} · {p.pieces}/{p.required} (partial)
                </div>
                <div className="whitespace-pre-wrap text-xs text-amber-800/80">
                  {p.set.desc}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {pickerSlot ? (
        <ItemPicker
          open={pickerSlot !== null}
          onOpenChange={(o) => {
            if (!o) setPickerSlot(null)
          }}
          data={data}
          storage={storage}
          slotFilter={pickerSlot}
          ownedOnly
          allowClear
          title={`Equip ${SLOT_LABELS[pickerSlot]}`}
          emptyHint={`No ${SLOT_LABELS[pickerSlot].toLowerCase()} items in storage. Add some on the Storage tab first.`}
          onPick={(item) => {
            equipSlot(cat.id, pickerSlot, item ? item.code : null)
            setPickerSlot(null)
          }}
        />
      ) : null}
    </Card>
  )
}
