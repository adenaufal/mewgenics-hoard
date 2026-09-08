import { useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Download, Upload, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useDataset } from '@/lib/useDataset'
import { useTracker } from '@/stores/tracker'

export const Route = createFileRoute('/data')({
  component: DataPage,
})

function DataPage() {
  const ds = useDataset()
  const exportJSON = useTracker((s) => s.exportJSON)
  const importJSON = useTracker((s) => s.importJSON)
  const reset = useTracker((s) => s.reset)
  const storage = useTracker((s) => s.storage)
  const cats = useTracker((s) => s.cats)
  const plannedSets = useTracker((s) => s.plannedSets)
  const overrides = useTracker((s) => s.overrides)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const handleExport = () => {
    const json = exportJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const a = document.createElement('a')
    a.href = url
    a.download = `mewgenics-hoard-${ts}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Exported tracker state')
  }

  const handleImport = async (file: File) => {
    try {
      const text = await file.text()
      const result = importJSON(text)
      if (result.ok) toast.success('Imported tracker state')
      else toast.error(`Import failed: ${result.error}`)
    } catch (e) {
      toast.error(`Read failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const totalItems = Object.values(storage).reduce((a, b) => a + b, 0)
  const itemTypes = Object.keys(storage).filter((k) => storage[k]! > 0).length
  const planned = Object.keys(plannedSets).filter((k) => plannedSets[k]).length
  const overridden = Object.keys(overrides).length

  return (
    <section className="flex flex-col gap-3">
      <h2 className="sr-only">Data</h2>
      <Card>
        <CardContent className="flex flex-col gap-3 px-4 py-3">
          <h3 className="text-sm font-semibold">Tracker state</h3>
          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Stat label="Items in storage" value={totalItems} />
            <Stat label="Item types" value={itemTypes} />
            <Stat label="Cats" value={cats.length} />
            <Stat label="Planned sets" value={planned} />
            <Stat label="Manual overrides" value={overridden} />
            <Stat
              label="Dataset"
              value={
                ds.status === 'ready'
                  ? `${ds.data.items.length} items · ${ds.data.sets.length} sets`
                  : ds.status === 'loading'
                    ? 'loading...'
                    : 'failed'
              }
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 px-4 py-3">
          <h3 className="text-sm font-semibold">Backup</h3>
          <p className="text-xs text-stone-600">
            Tracker state lives in browser localStorage. Export to a JSON file to
            back up or move between browsers.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleExport}>
              <Download className="mr-1 size-4" /> Export JSON
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-1 size-4" /> Import JSON
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleImport(f)
                e.target.value = ''
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 px-4 py-3">
          <h3 className="text-sm font-semibold text-rose-700">Danger zone</h3>
          <p className="text-xs text-stone-600">
            Resetting clears storage, cats, planned sets, and overrides. Export
            first if you want a backup.
          </p>
          <div>
            <Button variant="destructive" onClick={() => setConfirmReset(true)}>
              <RotateCcw className="mr-1 size-4" /> Reset tracker
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset all tracker data?"
        description="Storage, cats, planned sets, and overrides will be permanently cleared. This cannot be undone."
        confirmLabel="Reset"
        destructive
        onConfirm={() => {
          reset()
          toast('Tracker reset')
          setConfirmReset(false)
        }}
      />
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-stone-500">
        {label}
      </dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  )
}
