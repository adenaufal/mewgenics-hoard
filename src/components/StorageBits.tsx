import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: string
}) {
  return (
    <Card className={cn('gap-0 border-l-4 border-l-stone-300 py-3', tone)}>
      <CardContent className="flex flex-col gap-0.5 px-3">
        <span className="text-[10px] font-medium uppercase tracking-wider text-stone-500">
          {label}
        </span>
        <span className="text-2xl font-semibold">{value}</span>
      </CardContent>
    </Card>
  )
}

export function EmptyStorage({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-md border border-dashed border-stone-300 bg-white px-4 py-8 text-center">
      <p className="text-sm text-stone-600">
        Storage is empty. Add your first item to start tracking.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-3 inline-flex items-center justify-center rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
      >
        + Add item
      </button>
    </div>
  )
}

export function LoadingShell() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-md bg-stone-200" />
        ))}
      </div>
      <div className="h-10 animate-pulse rounded-md bg-stone-200" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-md bg-stone-200" />
        ))}
      </div>
    </div>
  )
}
