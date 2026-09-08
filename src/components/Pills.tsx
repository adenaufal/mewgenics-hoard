import { cn } from '@/lib/utils'
import type { Verdict } from '@/types'

const verdictBorder: Record<Verdict, string> = {
  keep: 'border-l-emerald-600',
  meh: 'border-l-amber-500',
  trash: 'border-l-rose-600',
}

export const verdictBorderClass = (v: Verdict): string => verdictBorder[v]

const verdictDot: Record<Verdict, string> = {
  keep: 'bg-emerald-600',
  meh: 'bg-amber-500',
  trash: 'bg-rose-600',
}

export function VerdictDot({
  verdict,
  className,
}: {
  verdict: Verdict
  className?: string
}) {
  return (
    <span
      className={cn('size-2 shrink-0 rounded-full', verdictDot[verdict], className)}
      aria-hidden
    />
  )
}
