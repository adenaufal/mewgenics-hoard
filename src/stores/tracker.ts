import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  type Cat,
  type CatProxy,
  type SlotKind,
  type TrackerSchemaV2,
  type Verdict,
} from '@/types'
import { SLOT_ORDER } from '@/lib/data'

const STORAGE_KEY = 'mewgenics_tracker_v2'
const SCHEMA_VERSION = 2 as const

type Actions = {
  addItem: (code: string, delta?: number) => void
  removeItem: (code: string, delta?: number) => void
  addCat: (name?: string) => string
  removeCat: (id: string) => void
  renameCat: (id: string, name: string) => void
  equipSlot: (catId: string, slot: SlotKind, code: string | null) => void
  setProxy: (catId: string, proxy: CatProxy) => void
  togglePlanned: (setCode: string) => void
  setOverride: (code: string, verdict: Verdict | null) => void
  setSlotMax: (n: number) => void
  exportJSON: () => string
  importJSON: (json: string) => { ok: true } | { ok: false; error: string }
  reset: () => void
}

export type TrackerStore = TrackerSchemaV2 & Actions

const emptySlots = (): Cat['slots'] => ({
  head: null,
  face: null,
  neck: null,
  trinket: null,
  weapon: null,
})

const initialState: TrackerSchemaV2 = {
  schemaVersion: SCHEMA_VERSION,
  storage: {},
  cats: [],
  plannedSets: {},
  overrides: {},
  slotMax: 100,
}

function newId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  return `cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export const useTracker = create<TrackerStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addItem: (code, delta = 1) =>
        set((s) => ({
          storage: { ...s.storage, [code]: (s.storage[code] ?? 0) + delta },
        })),

      removeItem: (code, delta = 1) =>
        set((s) => {
          const next = { ...s.storage }
          const cur = (next[code] ?? 0) - delta
          if (cur <= 0) delete next[code]
          else next[code] = cur
          return { storage: next }
        }),

      addCat: (name) => {
        const id = newId()
        const cat: Cat = {
          id,
          name: name?.trim() || `Cat ${get().cats.length + 1}`,
          slots: emptySlots(),
          proxy: 0,
        }
        set((s) => ({ cats: [...s.cats, cat] }))
        return id
      },

      removeCat: (id) =>
        set((s) => ({ cats: s.cats.filter((c) => c.id !== id) })),

      renameCat: (id, name) =>
        set((s) => ({
          cats: s.cats.map((c) => (c.id === id ? { ...c, name } : c)),
        })),

      equipSlot: (catId, slot, code) =>
        set((s) => ({
          cats: s.cats.map((c) =>
            c.id === catId ? { ...c, slots: { ...c.slots, [slot]: code } } : c,
          ),
        })),

      setProxy: (catId, proxy) =>
        set((s) => ({
          cats: s.cats.map((c) => (c.id === catId ? { ...c, proxy } : c)),
        })),

      togglePlanned: (setCode) =>
        set((s) => {
          const next = { ...s.plannedSets }
          if (next[setCode]) delete next[setCode]
          else next[setCode] = true
          return { plannedSets: next }
        }),

      setOverride: (code, verdict) =>
        set((s) => {
          const next = { ...s.overrides }
          if (verdict === null) delete next[code]
          else next[code] = verdict
          return { overrides: next }
        }),

      setSlotMax: (n) => set({ slotMax: n }),

      exportJSON: () => {
        const s = get()
        const payload: TrackerSchemaV2 = {
          schemaVersion: SCHEMA_VERSION,
          storage: s.storage,
          cats: s.cats,
          plannedSets: s.plannedSets,
          overrides: s.overrides,
          slotMax: s.slotMax,
        }
        return JSON.stringify(payload, null, 2)
      },

      importJSON: (json) => {
        try {
          const parsed = JSON.parse(json) as Partial<TrackerSchemaV2>
          const migrated = migrate(parsed)
          set({ ...migrated })
          return { ok: true }
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) }
        }
      },

      reset: () => set({ ...initialState }),
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        schemaVersion: s.schemaVersion,
        storage: s.storage,
        cats: s.cats,
        plannedSets: s.plannedSets,
        overrides: s.overrides,
        slotMax: s.slotMax,
      }),
      // Pre-zustand-versioning data (the reference MVP) was written without
      // schemaVersion. zustand calls this when stored version !== current; we
      // reuse the same migrate() to also hydrate raw legacy payloads.
      migrate: (persisted) => migrate(persisted) as TrackerSchemaV2,
    },
  ),
)

function migrate(raw: unknown): TrackerSchemaV2 {
  if (!raw || typeof raw !== 'object') return { ...initialState }
  const r = raw as Partial<TrackerSchemaV2>
  const cats = Array.isArray(r.cats)
    ? r.cats.map((c) => ({
        id: typeof c?.id === 'string' && c.id ? c.id : newId(),
        name: typeof c?.name === 'string' ? c.name : 'Cat',
        slots: { ...emptySlots(), ...(c?.slots ?? {}) },
        proxy: ((): CatProxy => {
          const p = c?.proxy
          return p === 1 || p === 2 ? p : 0
        })(),
      }))
    : []
  // Ensure cat slots only have valid keys.
  for (const c of cats) {
    const next = emptySlots()
    for (const k of SLOT_ORDER) {
      const v = c.slots[k]
      next[k] = typeof v === 'string' && v ? v : null
    }
    c.slots = next
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    storage:
      r.storage && typeof r.storage === 'object'
        ? Object.fromEntries(
            Object.entries(r.storage).filter(
              ([, v]) => typeof v === 'number' && v > 0,
            ),
          )
        : {},
    cats,
    plannedSets:
      r.plannedSets && typeof r.plannedSets === 'object'
        ? Object.fromEntries(
            Object.entries(r.plannedSets).filter(([, v]) => v === true),
          )
        : {},
    overrides:
      r.overrides && typeof r.overrides === 'object'
        ? Object.fromEntries(
            Object.entries(r.overrides).filter(
              ([, v]) => v === 'keep' || v === 'meh' || v === 'trash',
            ),
          )
        : {},
    slotMax: typeof r.slotMax === 'number' && r.slotMax > 0 ? r.slotMax : 100,
  }
}

export const __test = { migrate, STORAGE_KEY, SCHEMA_VERSION }
