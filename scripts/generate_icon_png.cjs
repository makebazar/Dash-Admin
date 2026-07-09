const fs = require("node:fs")
const path = require("node:path")
const sharp = require("sharp")

const inputPath = path.join(process.cwd(), "public", "icons", "icon-512.png")
const outputPath = path.join(process.cwd(), "build", "icon.png")

async function generate() {
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    
    // Resize 512x512 icon to 1024x1024 to match the size electron-builder expects
    await sharp(inputPath)
      .resize(1024, 1024)
      .toFile(outputPath)
      
    console.log(`Generated icon at: ${outputPath}`)
  } catch (err) {
    console.error("Failed to generate icon:", err)
    process.exit(1)
  }
}

generate()
