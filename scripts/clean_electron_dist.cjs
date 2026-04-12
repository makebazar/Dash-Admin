const fs = require("node:fs")
const path = require("node:path")

const distRoot = path.join(__dirname, "..", "dist-electron")
const appStageRoot = path.join(__dirname, "..", ".electron-app")

fs.rmSync(distRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
fs.rmSync(appStageRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
console.log(`Cleaned ${distRoot}`)
