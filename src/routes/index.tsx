import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Plus, Minus, MoreVertical, ThumbsUp, ThumbsDown, Equal, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ItemPicker } from '@/components/ItemPicker'
import { ItemIcon } from '@/components/ItemIcon'
import { verdictBorderClass, VerdictDot } from '@/components/Pills'
import {
  EmptyStorage,
  LoadingShell,
  SummaryCard,
} from '@/components/StorageBits'
import { useDataset } from '@/lib/useDataset'
import { useTracker } from '@/stores/tracker'
import { RARITY_RANK, SLOT_LABELS } from '@/lib/data'
import { calcAllActiveSets } from '@/lib/setbonus'
import { buildEquippedMap, computeVerdict } from '@/lib/verdict'
import type { SlotKind, Verdict } from '@/types'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({
  component: StoragePage,
})

const verdictRank: Record<Verdict, number> = { keep: 3, meh: 2, trash: 1 }

function StoragePage() {
  const ds = useDataset()
  const storage = useTracker((s) => s.storage)
  const cats = useTracker((s) => s.cats)
  const plannedSets = useTracker((s) => s.plannedSets)
  const overrides = useTracker((s) => s.overrides)
  const addItem = useTracker((s) => s.addItem)
  const removeItem = useTracker((s) => s.removeItem)
  const setOverride = useTracker((s) => s.setOverride)

  const [search, setSearch] = useState('')
  const [slotFilter, setSlotFilter] = useState<SlotKind | 'all'>('all')
  const [verdictFilter, setVerdictFilter] = useState<Verdict | 'all'>('all')
  const [pickerOpen, setPickerOpen] = useState(false)

  const data = ds.status === 'ready' ? ds.data : null

  const computed = useMemo(() => {
    if (!data) return null
    const equipped = buildEquippedMap(cats)
    const activeCatSets = calcAllActiveSets(cats, data)
    const deps = {
      state: { storage, cats, plannedSets, overrides },
      data,
      equipped,
      activeCatSets,
    }
    const ownedCodes = Object.keys(storage).filter((c) => storage[c]! > 0)
    const rows = ownedCodes
      .map((code) => {
        const it = data.itemsByCode.get(code)
        if (!it) return null
        return { item: it, qty: storage[code]!, v: computeVerdict(code, deps) }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    rows.sort((a, b) => {
      const va = verdictRank[a.v.verdict]
      const vb = verdictRank[b.v.verdict]
      if (va !== vb) return vb - va
      return RARITY_RANK[b.item.rarity] - RARITY_RANK[a.item.rarity]
    })

    const totals = { keep: 0, meh: 0, trash: 0, total: 0, types: rows.length }
    for (const r of rows) {
      totals[r.v.verdict] += r.qty
      totals.total += r.qty
    }
    return { rows, totals }
  }, [data, storage, cats, plannedSets, overrides])

  if (ds.status === 'loading') return <LoadingShell />
  if (ds.status === 'error')
    return (
      <p className="text-sm text-rose-700">
        Failed to load dataset: {ds.error.message}
      </p>
    )
  if (!data || !computed) return null

  const filtered = computed.rows.filter((r) => {
    if (slotFilter !== 'all' && r.item.kind !== slotFilter) return false
    if (verdictFilter !== 'all' && r.v.verdict !== verdictFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !r.item.name.toLowerCase().includes(q) &&
        !r.item.code.toLowerCase().includes(q)
      )
        return false
    }
    return true
  })

  return (
    <section className="flex flex-col gap-4">
      <h2 className="sr-only">Storage</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryCard label="Total" value={computed.totals.total} />
        <SummaryCard
          label="Keep"
          value={computed.totals.keep}
          tone="border-l-emerald-600 text-emerald-700"
        />
        <SummaryCard
          label="Maybe"
          value={computed.totals.meh}
          tone="border-l-amber-500 text-amber-700"
        />
        <SummaryCard
          label="Trash"
          value={computed.totals.trash}
          tone="border-l-rose-600 text-rose-700"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64"
        />
        <Select
          value={slotFilter}
          onValueChange={(v) => setSlotFilter(v as SlotKind | 'all')}
        >
          <SelectTrigger className="w-32" aria-label="Filter by slot">
            <SelectValue placeholder="Slot" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All slots</SelectItem>
            {(['head', 'face', 'neck', 'trinket', 'weapon'] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {SLOT_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={verdictFilter}
          onValueChange={(v) => setVerdictFilter(v as Verdict | 'all')}
        >
          <SelectTrigger className="w-32" aria-label="Filter by verdict">
            <SelectValue placeholder="Verdict" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All verdicts</SelectItem>
            <SelectItem value="keep">Keep</SelectItem>
            <SelectItem value="meh">Maybe</SelectItem>
            <SelectItem value="trash">Trash</SelectItem>
          </SelectContent>
        </Select>
        <div className="grow" />
        <Button onClick={() => setPickerOpen(true)}>
          <Plus className="size-4" /> Add item
        </Button>
      </div>

      {computed.rows.length === 0 ? (
        <EmptyStorage onAdd={() => setPickerOpen(true)} />
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-500">
          No items match these filters.
        </p>
      ) : (
        <ul
          className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          aria-label="Storage items"
        >
          {filtered.map((r) => {
            const overridden = overrides[r.item.code] ?? null
            return (
              <li key={r.item.code}>
                <Card
                  className={cn(
                    'gap-1 border-l-4 py-2.5',
                    verdictBorderClass(r.v.verdict),
                  )}
                >
                  <CardContent className="flex flex-col gap-1.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <ItemIcon item={r.item} size="lg" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {r.item.name}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-stone-500">
                          <VerdictDot verdict={r.v.verdict} />
                          <span className="capitalize">
                            {r.v.verdict === 'meh' ? 'maybe' : r.v.verdict}
                          </span>
                          <span>·</span>
                          <span>{SLOT_LABELS[r.item.kind]}</span>
                          {overridden ? (
                            <span className="ml-1 rounded-full bg-stone-900 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-white">
                              override
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <QtyControls
                        qty={r.qty}
                        onInc={() => addItem(r.item.code)}
                        onDec={() => removeItem(r.item.code)}
                      />
                      <OverrideMenu
                        active={overridden}
                        onSet={(v) => setOverride(r.item.code, v)}
                      />
                    </div>
                    <p className="pl-[3.25rem] text-[11px] text-stone-600">
                      {r.v.reason}
                    </p>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <ItemPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        data={data}
        storage={storage}
        title="Add item to storage"
        onPick={(it) => {
          if (!it) return
          addItem(it.code)
          toast.success(`Added ${it.name}`)
          setPickerOpen(false)
        }}
      />
    </section>
  )
}

function QtyControls({
  qty,
  onInc,
  onDec,
}: {
  qty: number
  onInc: () => void
  onDec: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button
        size="icon"
        variant="outline"
        className="size-9"
        onClick={onDec}
        aria-label="Decrease quantity"
      >
        <Minus className="size-3.5" />
      </Button>
      <span
        className="min-w-7 text-center text-sm font-semibold tabular-nums"
        aria-label={`Quantity ${qty}`}
      >
        {qty}
      </span>
      <Button
        size="icon"
        variant="outline"
        className="size-9"
        onClick={onInc}
        aria-label="Increase quantity"
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  )
}

function OverrideMenu({
  active,
  onSet,
}: {
  active: Verdict | null
  onSet: (v: Verdict | null) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={cn(
            'size-9',
            active && 'text-stone-900',
          )}
          aria-label="Override verdict"
        >
          <MoreVertical className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        <div className="px-2 pb-1 pt-1.5 text-[10px] uppercase tracking-wider text-stone-500">
          Override verdict
        </div>
        {(
          [
            { v: 'keep', label: 'Keep', Icon: ThumbsUp, className: 'text-emerald-700' },
            { v: 'meh', label: 'Maybe', Icon: Equal, className: 'text-amber-700' },
            { v: 'trash', label: 'Trash', Icon: ThumbsDown, className: 'text-rose-700' },
          ] as const
        ).map(({ v, label, Icon, className }) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              onSet(active === v ? null : v)
              setOpen(false)
            }}
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-stone-100 focus-visible:bg-stone-100 focus-visible:outline-none',
              active === v && 'bg-stone-100 font-semibold',
            )}
          >
            <Icon className={cn('size-4', className)} />
            {label}
          </button>
        ))}
        {active ? (
          <button
            type="button"
            onClick={() => {
              onSet(null)
              setOpen(false)
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-sm border-t border-stone-200 px-2 pb-1.5 pt-2 text-left text-xs text-stone-500 hover:text-stone-900"
          >
            <RotateCcw className="size-3.5" /> Clear override
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
