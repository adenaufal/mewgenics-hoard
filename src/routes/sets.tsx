import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ItemIcon } from '@/components/ItemIcon'
import { useDataset } from '@/lib/useDataset'
import { useTracker } from '@/stores/tracker'
import { calcAllActiveSets } from '@/lib/setbonus'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/sets')({
  component: SetsPage,
})

type Filter = 'all' | 'complete' | 'partial' | 'planned'

function SetsPage() {
  const ds = useDataset()
  const storage = useTracker((s) => s.storage)
  const cats = useTracker((s) => s.cats)
  const plannedSets = useTracker((s) => s.plannedSets)
  const togglePlanned = useTracker((s) => s.togglePlanned)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const data = ds.status === 'ready' ? ds.data : null

  const rows = useMemo(() => {
    if (!data) return null
    const activeOnCats = calcAllActiveSets(cats, data)
    return data.sets.map((s) => {
      const members = data.setToItems.get(s.idx) ?? []
      let ownedQty = 0
      let ownedUnique = 0
      for (const m of members) {
        const q = storage[m.code] ?? 0
        if (q > 0) {
          ownedQty += q
          ownedUnique += 1
        }
      }
      return {
        set: s,
        members,
        ownedQty,
        ownedUnique,
        active: activeOnCats.has(s.code),
        planned: plannedSets[s.code] === true,
      }
    })
  }, [data, storage, cats, plannedSets])

  if (ds.status === 'loading')
    return <div className="h-32 animate-pulse rounded-md bg-stone-200" />
  if (ds.status === 'error')
    return (
      <p className="text-sm text-rose-700">
        Failed to load dataset: {ds.error.message}
      </p>
    )
  if (!data || !rows) return null

  const filtered = rows.filter((r) => {
    if (filter === 'complete' && !r.active) return false
    if (
      filter === 'partial' &&
      !(r.ownedUnique > 0 && r.ownedUnique < r.members.length)
    )
      return false
    if (filter === 'planned' && !r.planned) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !r.set.code.toLowerCase().includes(q) &&
        !r.set.desc.toLowerCase().includes(q)
      )
        return false
    }
    return true
  })

  const chips: { v: Filter; label: string }[] = [
    { v: 'all', label: 'All' },
    { v: 'complete', label: 'Active' },
    { v: 'partial', label: 'Partial' },
    { v: 'planned', label: 'Planned' },
  ]

  return (
    <section className="flex flex-col gap-3">
      <h2 className="sr-only">Sets</h2>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search sets or bonus text..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72"
        />
        <div className="flex flex-wrap gap-1">
          {chips.map((c) => (
            <button
              key={c.v}
              type="button"
              onClick={() => setFilter(c.v)}
              className={cn(
                'min-h-9 rounded-full border px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2',
                filter === c.v
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-100',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-stone-500">
          {filtered.length} / {rows.length}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {filtered.map((r) => (
          <Card key={r.set.idx} className="gap-2 py-3">
            <CardContent className="flex flex-col gap-2 px-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-2">
                <h3 className="text-sm font-semibold">{r.set.code}</h3>
                <div className="flex items-center gap-1.5 text-[11px]">
                  {r.active ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                      Active
                    </span>
                  ) : null}
                  <Button
                    variant={r.planned ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => togglePlanned(r.set.code)}
                  >
                    {r.planned ? (
                      <>
                        <Check className="mr-1 size-3.5" /> Planned
                      </>
                    ) : (
                      'Plan this set'
                    )}
                  </Button>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-xs text-stone-600">
                {r.set.desc}
              </p>
              <div
                className={cn(
                  'text-xs',
                  r.ownedUnique >= 3
                    ? 'font-semibold text-emerald-700'
                    : r.ownedUnique > 0
                      ? 'font-medium text-amber-700'
                      : 'text-stone-500',
                )}
              >
                {r.ownedUnique}/{r.members.length} unique pieces · {r.ownedQty}{' '}
                total
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.members.map((m) => {
                  const q = storage[m.code] ?? 0
                  return (
                    <span
                      key={m.code}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md border px-1.5 py-1',
                        q > 0
                          ? 'border-emerald-400 bg-emerald-50'
                          : 'border-stone-200 bg-stone-50 opacity-60',
                      )}
                      title={`${m.name} · ${m.kind} · ${m.rarity}`}
                    >
                      <ItemIcon item={m} size="sm" />
                      {q > 0 ? (
                        <span className="text-[10px] font-semibold text-emerald-800">
                          x{q}
                        </span>
                      ) : null}
                    </span>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
