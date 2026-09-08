// Grid detection for Mewgenics storage screenshots.
// Uses gradient-based autocorrelation + comb filter to find the item grid.
//
// Strategy:
// 1. Compute horizontal/vertical gradient magnitude profiles
// 2. Find dominant period via autocorrelation (= cell size)
// 3. Use comb filter to find best grid alignment (phase)
// 4. Generate cell coordinates from the detected grid

export type GridCell = {
  x: number
  y: number
  width: number
  height: number
}

export type DetectedGrid = {
  cells: GridCell[]
  cols: number
  rows: number
  originX: number
  originY: number
  cellSize: number
}

export function detectGrid(
  canvas: HTMLCanvasElement,
  options: {
    minCellSize?: number
    maxCellSize?: number
    side?: 'storage' | 'trash' | 'full'
  } = {},
): DetectedGrid | null {
  const {
    minCellSize = 50,
    maxCellSize = 120,
    side = 'storage',
  } = options

  const { width, height } = canvas
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.getImageData(0, 0, width, height)
  const gray = toGrayscale(imgData)

  let scanX0: number, scanX1: number
  if (side === 'storage') {
    scanX0 = Math.round(width * 0.02)
    scanX1 = Math.round(width * 0.47)
  } else if (side === 'trash') {
    scanX0 = Math.round(width * 0.50)
    scanX1 = Math.round(width * 0.98)
  } else {
    scanX0 = Math.round(width * 0.02)
    scanX1 = Math.round(width * 0.98)
  }
  const scanY0 = Math.round(height * 0.15)
  const scanY1 = Math.round(height * 0.98)

  const colGrad = computeColGradient(gray, width, scanX0, scanX1, scanY0, scanY1)
  const rowGrad = computeRowGradient(gray, width, scanX0, scanX1, scanY0, scanY1)

  const colPeriod = findPeriod(colGrad, minCellSize, maxCellSize)
  const rowPeriod = findPeriod(rowGrad, minCellSize, maxCellSize)

  if (!colPeriod || !rowPeriod) return null

  const colResult = combFilter(colGrad, colPeriod)
  const rowResult = combFilter(rowGrad, rowPeriod)

  if (colResult.positions.length < 2 || rowResult.positions.length < 2) return null

  const cols = colResult.positions.length - 1
  const rows = rowResult.positions.length - 1
  const cellSize = Math.round((colPeriod + rowPeriod) / 2)

  const originX = scanX0 + colResult.positions[0]!
  const originY = scanY0 + rowResult.positions[0]!

  const cells: GridCell[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = scanX0 + colResult.positions[c]!
      const y = scanY0 + rowResult.positions[r]!
      const w = colResult.positions[c + 1]! - colResult.positions[c]!
      const h = rowResult.positions[r + 1]! - rowResult.positions[r]!
      cells.push({ x, y, width: w, height: h })
    }
  }

  return { cells, cols, rows, originX, originY, cellSize }
}

function toGrayscale(imgData: ImageData): Uint8Array {
  const { data, width, height } = imgData
  const gray = new Uint8Array(width * height)
  for (let i = 0; i < gray.length; i++) {
    const j = i * 4
    gray[i] = Math.round(0.299 * data[j]! + 0.587 * data[j + 1]! + 0.114 * data[j + 2]!)
  }
  return gray
}

function computeColGradient(
  gray: Uint8Array, width: number,
  x0: number, x1: number, y0: number, y1: number,
): Float32Array {
  const len = x1 - x0
  const profile = new Float32Array(len)
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1 - 1; x++) {
      const idx = x - x0
      profile[idx] = profile[idx]! + Math.abs(gray[y * width + x + 1]! - gray[y * width + x]!)
    }
  }
  const rowCount = y1 - y0
  for (let i = 0; i < len; i++) profile[i] = profile[i]! / rowCount
  return profile
}

function computeRowGradient(
  gray: Uint8Array, width: number,
  x0: number, x1: number, y0: number, y1: number,
): Float32Array {
  const len = y1 - y0
  const profile = new Float32Array(len)
  for (let x = x0; x < x1; x++) {
    for (let y = y0; y < y1 - 1; y++) {
      const idx = y - y0
      profile[idx] = profile[idx]! + Math.abs(gray[(y + 1) * width + x]! - gray[y * width + x]!)
    }
  }
  const colCount = x1 - x0
  for (let i = 0; i < len; i++) profile[i] = profile[i]! / colCount
  return profile
}

function findPeriod(profile: Float32Array, minP: number, maxP: number): number | null {
  const len = profile.length
  let bestP = 0
  let bestCorr = 0
  for (let p = minP; p <= maxP; p++) {
    let corr = 0
    let count = 0
    for (let i = 0; i < len - p; i++) {
      corr += profile[i]! * profile[i + p]!
      count++
    }
    corr /= count
    if (corr > bestCorr) {
      bestCorr = corr
      bestP = p
    }
  }
  return bestP || null
}

function combFilter(
  profile: Float32Array,
  period: number,
): { phase: number; teeth: number; positions: number[] } {
  const len = profile.length
  let bestPhase = 0
  let bestScore = 0

  for (let phase = 0; phase < period; phase++) {
    let score = 0
    for (let pos = phase; pos < len; pos += period) {
      for (let d = -2; d <= 2; d++) {
        const idx = pos + d
        if (idx >= 0 && idx < len) score += profile[idx]!
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestPhase = phase
    }
  }

  const positions: number[] = []
  for (let pos = bestPhase; pos < len; pos += period) {
    positions.push(pos)
  }

  return { phase: bestPhase, teeth: positions.length, positions }
}

export function manualGrid(
  x: number, y: number,
  cellSize: number,
  cols: number, rows: number,
): DetectedGrid {
  const cells: GridCell[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        x: x + c * cellSize,
        y: y + r * cellSize,
        width: cellSize,
        height: cellSize,
      })
    }
  }
  return { cells, cols, rows, originX: x, originY: y, cellSize }
}