#!/usr/bin/env node
// Copies item icon PNGs from the local mewcodex.github.io clone into
// public/icons/<kind>/<frame>.png so Vite serves them with the same path
// shape <ItemIcon> expects.
//
// Source layout:
//   ../archive/mewcodex.github.io/{HeadItemIcon,FaceItemIcon,NeckItemIcon,TrinketIcon,WeaponIcon}/<frame>.png
// Destination:
//   public/icons/{head,face,neck,trinket,weapon}/<frame>.png
//
// Only copies frames referenced by items in items.json (≈ 1131 frames),
// not every file in the source folders. Output footprint: ~1-2 MB total.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const codexRoot = resolve(projectRoot, '..', 'archive', 'mewcodex.github.io')

const SRC_FOLDER = {
  head: 'HeadItemIcon',
  face: 'FaceItemIcon',
  neck: 'NeckItemIcon',
  trinket: 'TrinketIcon',
  weapon: 'WeaponIcon',
}

const itemsPath = resolve(projectRoot, 'public/data/items.json')
if (!existsSync(itemsPath)) {
  throw new Error(
    `${itemsPath} not found — run scripts/split-dataset.mjs first.`,
  )
}
let items
try {
  items = JSON.parse(readFileSync(itemsPath, 'utf8'))
} catch (err) {
  throw new Error(
    `Failed to parse items.json (${itemsPath}): ${err instanceof Error ? err.message : String(err)}`,
  )
}

let copied = 0
let skipped = 0
let missing = 0
const seen = new Set()

for (const tuple of items) {
  const [, , kind, , , , frame] = tuple
  const key = `${kind}:${frame}`
  if (seen.has(key)) continue
  seen.add(key)

  const srcDir = SRC_FOLDER[kind]
  if (!srcDir) continue
  const src = resolve(codexRoot, srcDir, `${frame}.png`)
  const destDir = resolve(projectRoot, 'public/icons', kind)
  const dest = resolve(destDir, `${frame}.png`)
  if (!existsSync(src)) {
    missing++
    if (missing <= 5) console.warn(`  MISSING: ${src}`)
    continue
  }
  if (existsSync(dest)) {
    skipped++
    continue
  }
  mkdirSync(destDir, { recursive: true })
  copyFileSync(src, dest)
  copied++
}

console.log(
  `Icons: copied=${copied}, skipped (already present)=${skipped}, missing=${missing}`,
)
console.log(`→ ${resolve(projectRoot, 'public/icons')}`)

// Sanity: report how many files now live in each kind folder.
for (const [kind] of Object.entries(SRC_FOLDER)) {
  const dir = resolve(projectRoot, 'public/icons', kind)
  if (!existsSync(dir)) continue
  const n = readdirSync(dir).filter((f) => f.endsWith('.png')).length
  console.log(`  ${kind}: ${n} png`)
}
