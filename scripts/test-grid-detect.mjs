#!/usr/bin/env node
// Test grid detection v3: autocorrelation + comb filter approach.
// 1. Find dominant period via autocorrelation of gradient profile
// 2. Use comb filter (periodic template) to find best grid alignment
// 3. Extend grid from the best alignment

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const screenshotPath = resolve(projectRoot, '..', 'screenshot.webp')

async function main() {
  const { data, info } = await sharp(screenshotPath)
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  console.log(`Image: ${width}x${height}`)

  const gray = new Uint8Array(width * height)
  for (let i = 0; i < gray.length; i++) {
    const j = i * channels
    gray[i] = Math.round(0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2])
  }

  // Scan the left portion (storage panel) excluding frame borders
  const scanX0 = Math.round(width * 0.02)
  const scanX1 = Math.round(width * 0.47)
  const scanY0 = Math.round(height * 0.15)
  const scanY1 = Math.round(height * 0.98)

  console.log(`Scan: x=[${scanX0},${scanX1}] y=[${scanY0},${scanY1}]`)

  // Compute gradient profiles
  const colGrad = computeColGradient(gray, width, scanX0, scanX1, scanY0, scanY1)
  const rowGrad = computeRowGradient(gray, width, scanX0, scanX1, scanY0, scanY1)

  // Find dominant period via autocorrelation
  const colPeriod = findPeriod(colGrad, 50, 120)
  const rowPeriod = findPeriod(rowGrad, 50, 120)
  console.log(`Periods: col=${colPeriod}, row=${rowPeriod}`)

  if (!colPeriod || !rowPeriod) {
    console.log('FAILED: could not find period')
    return
  }

  // Use comb filter to find best grid alignment
  const colResult = combFilter(colGrad, colPeriod)
  const rowResult = combFilter(rowGrad, rowPeriod)

  console.log(`\nColumn comb: phase=${colResult.phase}, teeth=${colResult.teeth}`)
  console.log(`  Grid lines at:`, colResult.positions.map(p => p + scanX0))
  console.log(`Row comb: phase=${rowResult.phase}, teeth=${rowResult.teeth}`)
  console.log(`  Grid lines at:`, rowResult.positions.map(p => p + scanY0))

  const cols = colResult.teeth - 1
  const rows = rowResult.teeth - 1
  console.log(`\nResult: ${cols} cols x ${rows} rows`)
  console.log(`Cell size: ${colPeriod}x${rowPeriod}`)
  console.log(`Origin: (${colResult.positions[0] + scanX0}, ${rowResult.positions[0] + scanY0})`)
}

function computeColGradient(gray, width, x0, x1, y0, y1) {
  const len = x1 - x0
  const profile = new Float32Array(len)
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1 - 1; x++) {
      profile[x - x0] += Math.abs(gray[y * width + x + 1] - gray[y * width + x])
    }
  }
  const rows = y1 - y0
  for (let i = 0; i < len; i++) profile[i] /= rows
  return profile
}

function computeRowGradient(gray, width, x0, x1, y0, y1) {
  const len = y1 - y0
  const profile = new Float32Array(len)
  for (let x = x0; x < x1; x++) {
    for (let y = y0; y < y1 - 1; y++) {
      profile[y - y0] += Math.abs(gray[(y + 1) * width + x] - gray[y * width + x])
    }
  }
  const cols = x1 - x0
  for (let i = 0; i < len; i++) profile[i] /= cols
  return profile
}

function findPeriod(profile, minP, maxP) {
  const len = profile.length
  let bestP = 0, bestCorr = 0
  for (let p = minP; p <= maxP; p++) {
    let corr = 0, count = 0
    for (let i = 0; i < len - p; i++) {
      corr += profile[i] * profile[i + p]
      count++
    }
    corr /= count
    if (corr > bestCorr) { bestCorr = corr; bestP = p }
  }
  return bestP || null
}

function combFilter(profile, period) {
  const len = profile.length
  // For each possible starting phase (0 to period-1),
  // compute the sum of profile values at phase, phase+period, phase+2*period, ...
  // The phase with the highest sum is the best grid alignment.
  let bestPhase = 0
  let bestScore = 0
  let bestTeeth = 0

  for (let phase = 0; phase < period; phase++) {
    let score = 0
    let teeth = 0
    for (let pos = phase; pos < len; pos += period) {
      // Sum gradient in a small window around the position (±2px)
      let localSum = 0
      for (let d = -2; d <= 2; d++) {
        const idx = pos + d
        if (idx >= 0 && idx < len) localSum += profile[idx]
      }
      score += localSum
      teeth++
    }
    if (score > bestScore) {
      bestScore = score
      bestPhase = phase
      bestTeeth = teeth
    }
  }

  // Generate the grid line positions
  const positions = []
  for (let pos = bestPhase; pos < len; pos += period) {
    positions.push(pos)
  }

  return { phase: bestPhase, teeth: bestTeeth, positions, score: bestScore }
}

main().catch(console.error)
