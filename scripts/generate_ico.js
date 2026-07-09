const fs = require("node:fs")
const path = require("node:path")
const sharp = require("sharp")

const inputPath = path.join(process.cwd(), "public", "icons", "icon-512.png")
const outputPath = path.join(
  process.cwd(),
  "dashadmin-agent-dotnet",
  "DashAdminAgent",
  "Assets",
  "icon.ico"
)

async function generateIco() {
  try {
    // 1. Resize to 256x256 PNG
    const pngBuffer = await sharp(inputPath)
      .resize(256, 256)
      .png()
      .toBuffer()

    // 2. Build ICO format container
    const header = Buffer.alloc(6)
    header.writeUInt16LE(0, 0) // Reserved
    header.writeUInt16LE(1, 2) // Type (1 = ICO)
    header.writeUInt16LE(1, 4) // Count of images (1)

    const dirEntry = Buffer.alloc(16)
    dirEntry.writeUInt8(0, 0) // Width (0 means 256)
    dirEntry.writeUInt8(0, 1) // Height (0 means 256)
    dirEntry.writeUInt8(0, 2) // Colors (0 = no palette)
    dirEntry.writeUInt8(0, 3) // Reserved
    dirEntry.writeUInt16LE(1, 4) // Color planes (1)
    dirEntry.writeUInt16LE(32, 6) // Bits per pixel (32)
    dirEntry.writeUInt32LE(pngBuffer.length, 8) // Size of PNG data
    dirEntry.writeUInt32LE(6 + 16, 12) // Offset of PNG data

    const icoData = Buffer.concat([header, dirEntry, pngBuffer])

    // 3. Write to destination
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, icoData)
    console.log(`Generated ICO icon at: ${outputPath}`)
  } catch (err) {
    console.error("Failed to generate ICO:", err)
    process.exit(1)
  }
}

generateIco()
