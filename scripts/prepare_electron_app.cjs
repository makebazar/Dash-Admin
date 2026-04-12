const fs = require("node:fs")
const path = require("node:path")

const rootDir = path.join(__dirname, "..")
const stageDir = path.join(rootDir, ".electron-app")
const rootPackageJson = require(path.join(rootDir, "package.json"))

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true })
}

function copyFile(sourcePath, targetPath) {
  ensureDir(path.dirname(targetPath))
  fs.copyFileSync(sourcePath, targetPath)
}

function copyDir(sourcePath, targetPath) {
  ensureDir(targetPath)

  for (const entry of fs.readdirSync(sourcePath, { withFileTypes: true })) {
    const sourceEntryPath = path.join(sourcePath, entry.name)
    const targetEntryPath = path.join(targetPath, entry.name)

    if (entry.isDirectory()) {
      copyDir(sourceEntryPath, targetEntryPath)
    } else if (entry.isFile()) {
      copyFile(sourceEntryPath, targetEntryPath)
    }
  }
}

fs.rmSync(stageDir, { recursive: true, force: true })

copyDir(path.join(rootDir, "electron"), path.join(stageDir, "electron"))
copyDir(path.join(rootDir, "player-app", "dist"), path.join(stageDir, "player-app", "dist"))
copyFile(path.join(rootDir, "build", "icon.png"), path.join(stageDir, "build", "icon.png"))

const stagePackageJson = {
  name: "dashadmin-screen",
  version: rootPackageJson.version,
  description: rootPackageJson.description,
  author: rootPackageJson.author,
  main: "electron/main.cjs",
}

fs.writeFileSync(
  path.join(stageDir, "package.json"),
  `${JSON.stringify(stagePackageJson, null, 2)}\n`,
  "utf8"
)

console.log(`Prepared ${stageDir}`)
