const fs = require("node:fs")
const path = require("node:path")
const zlib = require("node:zlib")

const size = 1024
const outputPath = path.join(process.cwd(), "build", "icon.png")

const pixels = Buffer.alloc(size * size * 4)

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const index = (y * size + x) * 4
    pixels[index] = 5
    pixels[index + 1] = 8
    pixels[index + 2] = 22
    pixels[index + 3] = 255
  }
}

const bolt = [
  [600, 170],
  [300, 560],
  [456, 560],
  [420, 856],
  [752, 452],
  [586, 452],
  [624, 190],
]

function pointInPolygon(x, y, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0]
    const yi = polygon[i][1]
    const xj = polygon[j][0]
    const yj = polygon[j][1]

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi
    if (intersect) inside = !inside
  }
  return inside
}

for (let y = 120; y < 900; y++) {
  for (let x = 220; x < 800; x++) {
    if (!pointInPolygon(x, y, bolt)) continue
    const index = (y * size + x) * 4
    pixels[index] = 255
    pixels[index + 1] = 255
    pixels[index + 2] = 255
    pixels[index + 3] = 255
  }
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type)
  const lengthBuffer = Buffer.alloc(4)
  lengthBuffer.writeUInt32BE(data.length, 0)

  const crcBuffer = Buffer.alloc(4)
  const crcValue = crc32(Buffer.concat([typeBuffer, data]))
  crcBuffer.writeUInt32BE(crcValue, 0)

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer])
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(size, 0)
ihdr.writeUInt32BE(size, 4)
ihdr[8] = 8
ihdr[9] = 6
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const rawRows = Buffer.alloc((size * 4 + 1) * size)
for (let y = 0; y < size; y++) {
  const rowStart = y * (size * 4 + 1)
  rawRows[rowStart] = 0
  pixels.copy(rawRows, rowStart + 1, y * size * 4, (y + 1) * size * 4)
}

const idat = zlib.deflateSync(rawRows, { level: 9 })

const png = Buffer.concat([
  signature,
  pngChunk("IHDR", ihdr),
  pngChunk("IDAT", idat),
  pngChunk("IEND", Buffer.alloc(0)),
])

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, png)
console.log(`Generated ${outputPath}`)
