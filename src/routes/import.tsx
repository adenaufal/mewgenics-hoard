import { useCallback, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Upload, Grid3X3, Check, X, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ItemIcon } from '@/components/ItemIcon'
import { useDataset } from '@/lib/useDataset'
import { useTracker } from '@/stores/tracker'
import { detectGrid, manualGrid, type DetectedGrid } from '@/lib/grid-detect'
import {
  computeDHashFromCanvas,
  findMatches,
  isEmptyCell,
  type HashDB,
  type MatchCandidate,
} from '@/lib/phash'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/import')({
  component: ImportPage,
})

type MatchedCell = {
  cellIdx: number
  hash: string
  candidates: MatchCandidate[]
  selected: string | null
}

type ImportState =
  | { step: 'upload' }
  | { step: 'detect'; image: HTMLCanvasElement; file: File }
  | { step: 'match'; image: HTMLCanvasElement; grid: DetectedGrid; matches: MatchedCell[] }
  | { step: 'done'; added: number }

function ImportPage() {
  const ds = useDataset()
  const addItem = useTracker((s) => s.addItem)
  const data = ds.status === 'ready' ? ds.data : null

  const [state, setState] = useState<ImportState>({ step: 'upload' })
  const [hashDB, setHashDB] = useState<HashDB | null>(null)
  const [loading, setLoading] = useState(false)

  // Manual grid params — pre-fill smart defaults based on image dimensions
  const [manualMode, setManualMode] = useState(false)
  const [gridParams, setGridParams] = useState({ x: 0, y: 0, size: 64, cols: 8, rows: 9 })

  // Load hash DB on first use
  const loadHashDB = useCallback(async () => {
    if (hashDB) return hashDB
    const res = await fetch(`${import.meta.env.BASE_URL}data/icon_hashes.json`)
    const db: HashDB = await res.json()
    setHashDB(db)
    return db
  }, [hashDB])

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please drop an image file')
      return
    }
    setLoading(true)
    const img = new Image()
    img.src = URL.createObjectURL(file)
    await new Promise<void>((resolve) => { img.onload = () => resolve() })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(img.src)

    // Pre-fill smart manual grid defaults based on image dimensions.
    // Mewgenics storage panel is roughly the left 45% of the screen,
    // grid starts ~18% from top, cells are ~width*0.45/8 pixels.
    const estCellSize = Math.round((img.naturalWidth * 0.42) / 8)
    setGridParams({
      x: Math.round(img.naturalWidth * 0.025),
      y: Math.round(img.naturalHeight * 0.19),
      size: estCellSize,
      cols: 8,
      rows: 8,
    })

    setState({ step: 'detect', image: canvas, file })
    setLoading(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }, [handleFile])

  const runDetection = useCallback(async (canvas: HTMLCanvasElement, grid: DetectedGrid) => {
    setLoading(true)
    const db = await loadHashDB()
    const matches: MatchedCell[] = []
    for (let i = 0; i < grid.cells.length; i++) {
      const cell = grid.cells[i]!
      if (isEmptyCell(canvas, cell.x, cell.y, cell.width, cell.height)) continue
      const padding = Math.round(cell.width * 0.1)
      const hash = computeDHashFromCanvas(
        canvas,
        cell.x + padding, cell.y + padding,
        cell.width - padding * 2, cell.height - padding * 2,
      )
      const candidates = findMatches(hash, db)
      if (candidates.length > 0) {
        matches.push({
          cellIdx: i,
          hash,
          candidates,
          selected: candidates[0]!.code,
        })
      }
    }
    setState({ step: 'match', image: canvas, grid, matches })
    setLoading(false)
  }, [loadHashDB])

  const handleAutoDetect = useCallback(() => {
    if (state.step !== 'detect') return
    const grid = detectGrid(state.image)
    if (!grid) {
      toast.error('Could not auto-detect grid. Try manual mode.')
      return
    }
    void runDetection(state.image, grid)
  }, [state, runDetection])

  const handleManualDetect = useCallback(() => {
    if (state.step !== 'detect') return
    const grid = manualGrid(gridParams.x, gridParams.y, gridParams.size, gridParams.cols, gridParams.rows)
    void runDetection(state.image, grid)
  }, [state, gridParams, runDetection])

  const handleAddAll = useCallback(() => {
    if (state.step !== 'match') return
    let added = 0
    for (const m of state.matches) {
      if (m.selected) {
        addItem(m.selected)
        added++
      }
    }
    toast.success(`Added ${added} items to storage`)
    setState({ step: 'done', added })
  }, [state, addItem])

  if (ds.status === 'loading') return <div className="h-32 animate-pulse rounded-md bg-stone-200" />
  if (ds.status === 'error') return <p className="text-sm text-rose-700">Failed to load dataset</p>
  if (!data) return null

  return (
    <section className="flex flex-col gap-4">
      <h2 className="sr-only">Import</h2>

      {state.step === 'upload' && (
        <DropZone
          onDrop={handleDrop}
          onFile={handleFile}
          loading={loading}
        />
      )}

      {state.step === 'detect' && (
        <DetectStep
          canvas={state.image}
          loading={loading}
          manualMode={manualMode}
          gridParams={gridParams}
          onManualToggle={() => setManualMode(!manualMode)}
          onGridParamsChange={setGridParams}
          onAutoDetect={handleAutoDetect}
          onManualDetect={handleManualDetect}
          onReset={() => setState({ step: 'upload' })}
        />
      )}

      {state.step === 'match' && (
        <MatchStep
          matches={state.matches}
          data={data}
          onSelect={(idx, code) => {
            setState((prev) => {
              if (prev.step !== 'match') return prev
              const matches = prev.matches.map((m, i) =>
                i === idx ? { cellIdx: m.cellIdx, hash: m.hash, candidates: m.candidates, selected: code } : m,
              )
              return { ...prev, matches }
            })
          }}
          onToggle={(idx) => {
            setState((prev) => {
              if (prev.step !== 'match') return prev
              const matches = prev.matches.map((m, i) => {
                if (i !== idx) return m
                return { cellIdx: m.cellIdx, hash: m.hash, candidates: m.candidates, selected: m.selected ? null : (m.candidates[0]?.code ?? null) }
              })
              return { ...prev, matches }
            })
          }}
          onAddAll={handleAddAll}
          onReset={() => setState({ step: 'upload' })}
        />
      )}

      {state.step === 'done' && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-4 py-8">
            <Check className="size-10 text-emerald-600" />
            <p className="text-sm font-medium">
              Added {state.added} items to storage.
            </p>
            <Button onClick={() => setState({ step: 'upload' })}>
              Import another screenshot
            </Button>
          </CardContent>
        </Card>
      )}
    </section>
  )
}

// --- Sub-components ---

function DropZone({
  onDrop,
  onFile,
  loading,
}: {
  onDrop: (e: React.DragEvent) => void
  onFile: (f: File) => void
  loading: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <Card>
      <CardContent
        className="flex flex-col items-center gap-4 px-4 py-12"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <ImageIcon className="size-12 text-stone-400" />
        <div className="text-center">
          <p className="text-sm font-medium">
            Drop a storage screenshot here
          </p>
          <p className="text-xs text-stone-500">
            or click to browse. Supports PNG/JPG from the game.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          <Upload className="mr-1.5 size-4" />
          {loading ? 'Loading...' : 'Choose file'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
            e.target.value = ''
          }}
        />
      </CardContent>
    </Card>
  )
}

function DetectStep({
  canvas,
  loading,
  manualMode,
  gridParams,
  onManualToggle,
  onGridParamsChange,
  onAutoDetect,
  onManualDetect,
  onReset,
}: {
  canvas: HTMLCanvasElement
  loading: boolean
  manualMode: boolean
  gridParams: { x: number; y: number; size: number; cols: number; rows: number }
  onManualToggle: () => void
  onGridParamsChange: (p: typeof gridParams) => void
  onAutoDetect: () => void
  onManualDetect: () => void
  onReset: () => void
}) {
  const previewRef = useCallback(
    (el: HTMLCanvasElement | null) => {
      if (!el) return
      const ctx = el.getContext('2d')!
      const scale = Math.min(el.parentElement!.clientWidth / canvas.width, 1)
      el.width = canvas.width * scale
      el.height = canvas.height * scale
      ctx.drawImage(canvas, 0, 0, el.width, el.height)
    },
    [canvas],
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-auto rounded-md border border-stone-200 bg-stone-50 p-2">
        <canvas ref={previewRef} className="max-w-full" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onAutoDetect} disabled={loading}>
          <Grid3X3 className="mr-1.5 size-4" />
          {loading ? 'Detecting...' : 'Auto-detect grid'}
        </Button>
        <Button variant="outline" onClick={onManualToggle}>
          {manualMode ? 'Hide manual' : 'Manual grid'}
        </Button>
        <div className="grow" />
        <Button variant="ghost" onClick={onReset}>
          <X className="mr-1 size-4" /> Start over
        </Button>
      </div>

      {manualMode && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-5">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-stone-500">X offset</span>
              <Input
                type="number" value={gridParams.x}
                onChange={(e) => onGridParamsChange({ ...gridParams, x: +e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-stone-500">Y offset</span>
              <Input
                type="number" value={gridParams.y}
                onChange={(e) => onGridParamsChange({ ...gridParams, y: +e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-stone-500">Cell size</span>
              <Input
                type="number" value={gridParams.size}
                onChange={(e) => onGridParamsChange({ ...gridParams, size: +e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-stone-500">Columns</span>
              <Input
                type="number" value={gridParams.cols}
                onChange={(e) => onGridParamsChange({ ...gridParams, cols: +e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-stone-500">Rows</span>
              <Input
                type="number" value={gridParams.rows}
                onChange={(e) => onGridParamsChange({ ...gridParams, rows: +e.target.value })}
              />
            </label>
            <Button className="col-span-2 sm:col-span-5" onClick={onManualDetect} disabled={loading}>
              {loading ? 'Matching...' : 'Detect with manual grid'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MatchStep({
  matches,
  data,
  onSelect,
  onToggle,
  onAddAll,
  onReset,
}: {
  matches: MatchedCell[]
  data: NonNullable<ReturnType<typeof useDataset>['data']>
  onSelect: (idx: number, code: string) => void
  onToggle: (idx: number) => void
  onAddAll: () => void
  onReset: () => void
}) {
  const selected = matches.filter((m) => m.selected).length
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">
          {matches.length} items detected · {selected} selected
        </p>
        <div className="grow" />
        <Button variant="ghost" onClick={onReset}>
          <X className="mr-1 size-4" /> Start over
        </Button>
        <Button onClick={onAddAll} disabled={selected === 0}>
          <Check className="mr-1 size-4" /> Add {selected} to storage
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {matches.map((m, idx) => {
          const item = m.selected ? data.itemsByCode.get(m.selected) : null
          const confidence = m.candidates[0]
            ? Math.max(0, Math.round((1 - m.candidates[0].distance / 64) * 100))
            : 0
          return (
            <Card
              key={idx}
              className={cn(
                'gap-1 py-2',
                m.selected ? 'border-emerald-300' : 'border-stone-200 opacity-60',
              )}
            >
              <CardContent className="flex items-center gap-3 px-3">
                <button
                  type="button"
                  onClick={() => onToggle(idx)}
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded border text-xs',
                    m.selected
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-stone-300',
                  )}
                  aria-label={m.selected ? 'Deselect' : 'Select'}
                >
                  {m.selected ? <Check className="size-3.5" /> : null}
                </button>
                {item ? <ItemIcon item={item} size="md" /> : <div className="size-10 rounded-md bg-stone-200" />}
                <div className="min-w-0 flex-1">
                  {item ? (
                    <div className="truncate text-sm font-medium">{item.name}</div>
                  ) : (
                    <div className="text-sm text-stone-500">No match</div>
                  )}
                  <div className="text-[11px] text-stone-500">
                    {confidence}% confidence
                    {m.candidates.length > 1 && (
                      <select
                        className="ml-2 rounded border border-stone-200 bg-white px-1 py-0.5 text-[11px]"
                        value={m.selected ?? ''}
                        onChange={(e) => onSelect(idx, e.target.value)}
                      >
                        {m.candidates.map((c) => {
                          const ci = data.itemsByCode.get(c.code)
                          return (
                            <option key={c.code} value={c.code}>
                              {ci?.name ?? c.code} ({Math.round((1 - c.distance / 64) * 100)}%)
                            </option>
                          )
                        })}
                      </select>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
