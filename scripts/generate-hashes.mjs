#!/usr/bin/env node
// Generates perceptual hashes (dHash 8x8 = 64-bit) for all item icons.
// Output: public/data/icon_hashes.json as { item_code: hash_hex, ... }
//
// dHash algorithm:
// 1. Resize icon to 9x8 grayscale (9 wide to get 8 horizontal differences)
// 2. For each row, compare adjacent pixels: left > right → bit=1, else bit=0
// 3. Result: 64 bits = 16 hex chars
//
// Requires: sharp (dev dependency)

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const itemsPath = resolve(projectRoot, 'public/data/items.json')
const outputPath = resolve(projectRoot, 'public/data/icon_hashes.json')
const iconsRoot = resolve(projectRoot, 'public/icons')

const items = JSON.parse(readFileSync(itemsPath, 'utf8'))

async function computeDHash(filePath) {
  const { data } = await sharp(filePath)
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  let hash = 0n
  let bit = 0
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = data[y * 9 + x]
      const right = data[y * 9 + x + 1]
      if (left > right) {
        hash |= 1n << BigInt(bit)
      }
      bit++
    }
  }
  return hash.toString(16).padStart(16, '0')
}

async function main() {
  const hashes = {}
  let processed = 0
  let errors = 0

  for (const tuple of items) {
    const [code, , kind, , , , frame] = tuple
    const iconPath = resolve(iconsRoot, kind, `${frame}.png`)
    try {
      hashes[code] = await computeDHash(iconPath)
      processed++
    } catch (e) {
      errors++
      if (errors <= 5) console.warn(`  ERROR: ${code} (${iconPath}): ${e.message}`)
    }
  }

  writeFileSync(outputPath, JSON.stringify(hashes, null, 0))
  console.log(`Generated ${processed} hashes, ${errors} errors`)
  console.log(`→ ${outputPath} (${Math.round(readFileSync(outputPath).length / 1024)} KB)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
