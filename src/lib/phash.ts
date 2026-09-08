// Perceptual hash (dHash 8x8) computation and matching utilities.
// Same algorithm as scripts/generate-hashes.mjs but runs in-browser via Canvas.

export type HashDB = Record<string, string>

export function computeDHash(imageData: ImageData, width: number, height: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = 9
  canvas.height = 8
  const ctx = canvas.getContext('2d')!
  const src = document.createElement('canvas')
  src.width = width
  src.height = height
  const srcCtx = src.getContext('2d')!
  srcCtx.putImageData(imageData, 0, 0)
  ctx.drawImage(src, 0, 0, 9, 8)
  const resized = ctx.getImageData(0, 0, 9, 8)
  const gray = new Uint8Array(9 * 8)
  for (let i = 0; i < 72; i++) {
    const r = resized.data[i * 4]!
    const g = resized.data[i * 4 + 1]!
    const b = resized.data[i * 4 + 2]!
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
  }
  let hash = 0n
  let bit = 0
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (gray[y * 9 + x]! > gray[y * 9 + x + 1]!) {
        hash |= 1n << BigInt(bit)
      }
      bit++
    }
  }
  return hash.toString(16).padStart(16, '0')
}

export function computeDHashFromCanvas(
  sourceCanvas: HTMLCanvasElement,
  sx: number, sy: number, sw: number, sh: number,
): string {
  const canvas = document.createElement('canvas')
  canvas.width = 9
  canvas.height = 8
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, 9, 8)
  const resized = ctx.getImageData(0, 0, 9, 8)
  const gray = new Uint8Array(72)
  for (let i = 0; i < 72; i++) {
    const r = resized.data[i * 4]!
    const g = resized.data[i * 4 + 1]!
    const b = resized.data[i * 4 + 2]!
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
  }
  let hash = 0n
  let bit = 0
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (gray[y * 9 + x]! > gray[y * 9 + x + 1]!) {
        hash |= 1n << BigInt(bit)
      }
      bit++
    }
  }
  return hash.toString(16).padStart(16, '0')
}

export function hammingDistance(a: string, b: string): number {
  const av = BigInt('0x' + a)
  const bv = BigInt('0x' + b)
  let xor = av ^ bv
  let dist = 0
  while (xor > 0n) {
    dist += Number(xor & 1n)
    xor >>= 1n
  }
  return dist
}

export type MatchCandidate = {
  code: string
  distance: number
}

export function findMatches(
  hash: string,
  db: HashDB,
  maxDistance = 12,
  topN = 5,
): MatchCandidate[] {
  const results: MatchCandidate[] = []
  for (const [code, dbHash] of Object.entries(db)) {
    const d = hammingDistance(hash, dbHash)
    if (d <= maxDistance) {
      results.push({ code, distance: d })
    }
  }
  results.sort((a, b) => a.distance - b.distance)
  return results.slice(0, topN)
}

export function isEmptyCell(
  canvas: HTMLCanvasElement,
  sx: number, sy: number, sw: number, sh: number,
  threshold = 0.80,
): boolean {
  const ctx = canvas.getContext('2d')!
  const data = ctx.getImageData(sx, sy, sw, sh).data
  let lightPixels = 0
  const total = sw * sh
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    if (lum > 170) lightPixels++
  }
  return lightPixels / total > threshold
}
