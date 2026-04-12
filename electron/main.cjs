const { app, BrowserWindow, ipcMain, screen, nativeImage } = require("electron")
const crypto = require("node:crypto")
const fs = require("node:fs")
const path = require("node:path")

const DEFAULT_PLAYER_URL = "http://127.0.0.1:3020"
const DEFAULT_SERVER_URL = "https://www.mydashadmin.ru"
const STORE_FILE = "signage-player.json"
const APP_TITLE = "DashAdmin экран"

let mainWindow = null
let remoteSyncInFlight = false
let remoteStreamAbortController = null
let remoteStreamRestartTimer = null
let heartbeatTimer = null
let isQuitting = false

function getWindowIconPath() {
  return path.join(app.getAppPath(), "build", "icon.png")
}

function getCustomUserDataDir() {
  const customUserDataDir = process.env.ELECTRON_USER_DATA_DIR
  if (!customUserDataDir) return null

  return path.isAbsolute(customUserDataDir)
    ? customUserDataDir
    : path.resolve(process.cwd(), customUserDataDir)
}

function getRemoteServerUrl() {
  return String(process.env.DASHADMIN_SERVER_URL || DEFAULT_SERVER_URL).replace(/\/+$/, "")
}

function getRuntimeConfig() {
  return {
    appName: APP_TITLE,
    serverUrl: getRemoteServerUrl(),
    isPackaged: app.isPackaged,
  }
}

function shouldForceLocalSignageApi(serverUrl) {
  try {
    const parsed = new URL(serverUrl)
    return ["127.0.0.1", "localhost"].includes(parsed.hostname)
  } catch {
    return false
  }
}

function buildRemoteHeaders(serverUrl, extraHeaders = {}) {
  return shouldForceLocalSignageApi(serverUrl)
    ? {
        ...extraHeaders,
        "x-dashadmin-local-signage": "1",
      }
    : extraHeaders
}

if (process.env.ELECTRON_NO_SANDBOX === "1") {
  app.commandLine.appendSwitch("no-sandbox")
  app.commandLine.appendSwitch("disable-setuid-sandbox")
}

if (process.env.ELECTRON_DISABLE_GPU === "1") {
  app.commandLine.appendSwitch("disable-gpu")
}

app.setName(APP_TITLE)

const customUserDataDir = getCustomUserDataDir()
if (customUserDataDir) {
  fs.mkdirSync(customUserDataDir, { recursive: true })
  app.setPath("userData", customUserDataDir)
  app.setPath("sessionData", path.join(customUserDataDir, "session"))
}

function getStorePath() {
  if (customUserDataDir) {
    return path.join(customUserDataDir, STORE_FILE)
  }

  return path.join(app.getPath("userData"), STORE_FILE)
}

function getRendererEntry() {
  if (process.env.ELECTRON_START_URL) {
    return {
      type: "url",
      value: process.env.ELECTRON_START_URL,
    }
  }

  if (app.isPackaged) {
    return {
      type: "file",
      value: path.join(app.getAppPath(), "player-app", "dist", "index.html"),
    }
  }

  return {
    type: "url",
    value: DEFAULT_PLAYER_URL,
  }
}

function createPairingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)])
    .join("")
    .replace(/(.{4})/, "$1-")
}

function readStore() {
  const filePath = getStorePath()

  if (!fs.existsSync(filePath)) {
    const initialState = {
      deviceId: crypto.randomUUID(),
      pairingCode: createPairingCode(),
      deviceToken: null,
      pairedClubId: null,
      pairedClubName: null,
      layoutJson: null,
      serverUpdatedAt: null,
      selectedDisplayId: null,
      fullscreen: false,
      orientation: "landscape",
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(initialState, null, 2), "utf8")
    return initialState
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch {
    const fallbackState = {
      deviceId: crypto.randomUUID(),
      pairingCode: createPairingCode(),
      deviceToken: null,
      pairedClubId: null,
      pairedClubName: null,
      layoutJson: null,
      serverUpdatedAt: null,
      selectedDisplayId: null,
      fullscreen: false,
      orientation: "landscape",
    }

    fs.writeFileSync(filePath, JSON.stringify(fallbackState, null, 2), "utf8")
    return fallbackState
  }
}

function writeStore(patch) {
  const nextState = {
    ...readStore(),
    ...patch,
  }

  fs.writeFileSync(getStorePath(), JSON.stringify(nextState, null, 2), "utf8")
  return nextState
}

function buildRemotePayload() {
  const state = readStore()
  return {
    deviceId: state.deviceId,
    deviceToken: state.deviceToken || null,
    pairingCode: state.pairingCode,
    selectedDisplayId: state.selectedDisplayId,
    orientation: state.orientation === "portrait" ? "portrait" : "landscape",
    displays: getDisplays(),
  }
}

function serializeDisplay(display, index, primaryDisplayId) {
  const label = display.label?.trim() || `Экран ${index + 1}`

  return {
    id: String(display.id),
    label,
    bounds: display.bounds,
    workArea: display.workArea,
    scaleFactor: display.scaleFactor,
    rotation: display.rotation,
    internal: display.internal,
    primary: String(display.id) === String(primaryDisplayId),
  }
}

function getDisplays() {
  const primaryDisplayId = screen.getPrimaryDisplay()?.id
  return screen
    .getAllDisplays()
    .map((display, index) => serializeDisplay(display, index, primaryDisplayId))
}

function getDisplayById(displayId) {
  if (!displayId) return null
  return screen.getAllDisplays().find((display) => String(display.id) === String(displayId)) || null
}

function getPreferredDisplay() {
  const state = readStore()
  return (
    getDisplayById(state.selectedDisplayId) ||
    screen.getPrimaryDisplay() ||
    screen.getAllDisplays()[0] ||
    null
  )
}

function getContentMetrics(display, orientation) {
  const width = display?.bounds?.width || 1920
  const height = display?.bounds?.height || 1080
  const isPortrait = orientation === "portrait"

  return isPortrait
    ? { width: Math.min(width, height), height: Math.max(width, height) }
    : { width: Math.max(width, height), height: Math.min(width, height) }
}

function exitNativeFullscreenModes(window) {
  if (!window || window.isDestroyed()) return

  if (typeof window.isSimpleFullScreen === "function" && window.isSimpleFullScreen()) {
    window.setSimpleFullScreen(false)
  }

  if (window.isFullScreen()) {
    window.setFullScreen(false)
  }

  if (window.isKiosk()) {
    window.setKiosk(false)
  }
}

function getFullscreenWindowBounds(display) {
  const bounds = display?.bounds || { x: 0, y: 0, width: 1920, height: 1080 }
  const edgeCompensation = process.platform === "win32"
    ? Math.max(2, Math.round(display?.scaleFactor || 1))
    : 0

  return {
    x: bounds.x - edgeCompensation,
    y: bounds.y - edgeCompensation,
    width: bounds.width + edgeCompensation * 2,
    height: bounds.height + edgeCompensation * 2,
  }
}

function applyDisplayMode() {
  if (!mainWindow || mainWindow.isDestroyed()) return

  const state = readStore()
  const targetDisplay = getPreferredDisplay()
  if (!targetDisplay) return

  if (state.fullscreen) {
    exitNativeFullscreenModes(mainWindow)
    mainWindow.setResizable(false)
    mainWindow.setMaximizable(false)
    mainWindow.setMinimizable(false)
    mainWindow.setMovable(false)
    mainWindow.setFullScreenable(false)
    mainWindow.setBounds(getFullscreenWindowBounds(targetDisplay))
    mainWindow.setAlwaysOnTop(true, process.platform === "darwin" ? "floating" : "screen-saver")
    mainWindow.setFocusable(true)
    mainWindow.setSkipTaskbar(true)
    mainWindow.focus()
  } else {
    exitNativeFullscreenModes(mainWindow)
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setSkipTaskbar(false)
    mainWindow.setMovable(true)
    mainWindow.setMinimizable(true)
    mainWindow.setMaximizable(true)
    mainWindow.setResizable(true)
    mainWindow.setFullScreenable(false)

    mainWindow.setBounds(targetDisplay.bounds)
    const displayWidth = Math.max(targetDisplay.workArea.width, 800)
    const displayHeight = Math.max(targetDisplay.workArea.height, 600)
    const aspectRatio = state.orientation === "portrait" ? 9 / 16 : 16 / 9

    let width = Math.round(displayWidth * 0.72)
    let height = Math.round(width / aspectRatio)

    if (height > displayHeight * 0.8) {
      height = Math.round(displayHeight * 0.8)
      width = Math.round(height * aspectRatio)
    }

    width = Math.max(720, Math.min(width, displayWidth))
    height = Math.max(560, Math.min(height, displayHeight))

    const x = targetDisplay.workArea.x + Math.round((targetDisplay.workArea.width - width) / 2)
    const y = targetDisplay.workArea.y + Math.round((targetDisplay.workArea.height - height) / 2)

    mainWindow.setBounds({ x, y, width, height })
  }
}

function setFullscreenEnabled(enabled) {
  writeStore({ fullscreen: Boolean(enabled) })
  applyDisplayMode()
  broadcastBootstrap()
  return buildBootstrapPayload()
}

function shouldExitFullscreenFromInput(input) {
  if (!input) return false

  const key = String(input.key || "")
  if (key === "Escape" || key === "F10") return true

  return Boolean(input.control || input.meta) && input.shift && key.toUpperCase() === "F"
}

function buildBootstrapPayload() {
  const state = readStore()
  const targetDisplay = getPreferredDisplay()
  const contentMetrics = getContentMetrics(
    targetDisplay,
    state.orientation === "portrait" ? "portrait" : "landscape"
  )

  return {
    deviceId: state.deviceId,
    pairingCode: state.pairingCode,
    deviceToken: state.deviceToken || null,
    pairedClubId: state.pairedClubId || null,
    pairedClubName: state.pairedClubName || null,
    layoutJson: state.layoutJson || null,
    serverUpdatedAt: state.serverUpdatedAt || null,
    fullscreen: Boolean(state.fullscreen),
    orientation: state.orientation === "portrait" ? "portrait" : "landscape",
    selectedDisplayId: state.selectedDisplayId ? String(state.selectedDisplayId) : null,
    contentWidth: contentMetrics.width,
    contentHeight: contentMetrics.height,
    displays: getDisplays(),
    version: app.getVersion(),
    platform: process.platform,
  }
}

function broadcastBootstrap() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send("signage:bootstrap-updated", buildBootstrapPayload())
}

function applyRemoteDeviceState(device) {
  if (!device) return buildBootstrapPayload()

  const previousState = readStore()
  const nextState = writeStore({
    pairingCode: device.pairingCode || previousState.pairingCode,
    deviceToken: device.deviceToken || null,
    pairedClubId: device.clubId ?? null,
    pairedClubName: device.clubName || null,
    layoutJson: device.layoutJson ?? null,
    serverUpdatedAt: device.serverUpdatedAt ? String(device.serverUpdatedAt) : null,
    orientation: device.orientation === "portrait" ? "portrait" : "landscape",
  })

  applyDisplayMode()
  broadcastBootstrap()

  if (
    previousState.deviceToken !== nextState.deviceToken
    || previousState.pairingCode !== nextState.pairingCode
  ) {
    restartRemoteStreamSoon()
  }

  return buildBootstrapPayload()
}

async function syncRemoteDevice() {
  const serverUrl = getRemoteServerUrl()
  if (!serverUrl || remoteSyncInFlight) return buildBootstrapPayload()

  remoteSyncInFlight = true

  try {
    const response = await fetch(`${serverUrl}/api/signage/device/bootstrap`, {
      method: "POST",
      headers: buildRemoteHeaders(serverUrl, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(buildRemotePayload()),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data?.error || `Bootstrap failed with status ${response.status}`)
    }

    return applyRemoteDeviceState(data.device)
  } catch (error) {
    console.error("Remote signage bootstrap error:", error)
    return buildBootstrapPayload()
  } finally {
    remoteSyncInFlight = false
  }
}

async function sendHeartbeat() {
  const serverUrl = getRemoteServerUrl()
  const state = readStore()
  if (!serverUrl || !state.deviceId) return

  try {
    await fetch(`${serverUrl}/api/signage/device/heartbeat`, {
      method: "POST",
      headers: buildRemoteHeaders(serverUrl, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        deviceId: state.deviceId,
        deviceToken: state.deviceToken || null,
      }),
    })
  } catch (error) {
    console.error("Remote signage heartbeat error:", error)
  }
}

function stopRemoteStream() {
  if (remoteStreamAbortController) {
    remoteStreamAbortController.abort()
    remoteStreamAbortController = null
  }
  if (remoteStreamRestartTimer) {
    clearTimeout(remoteStreamRestartTimer)
    remoteStreamRestartTimer = null
  }
}

function restartRemoteStreamSoon() {
  if (isQuitting) return
  stopRemoteStream()
  remoteStreamRestartTimer = setTimeout(() => {
    void startRemoteStream()
  }, 250)
}

function parseEventStreamChunk(chunk) {
  const lines = chunk.split("\n")
  let event = "message"
  const dataLines = []

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim()
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim())
    }
  }

  return {
    event,
    data: dataLines.join("\n"),
  }
}

async function startRemoteStream() {
  const serverUrl = getRemoteServerUrl()
  const state = readStore()

  if (!serverUrl || !state.deviceId) return

  stopRemoteStream()

  const params = new URLSearchParams({
    deviceId: state.deviceId,
  })

  if (state.deviceToken) {
    params.set("deviceToken", state.deviceToken)
  } else if (state.pairingCode) {
    params.set("pairingCode", state.pairingCode)
  }

  const controller = new AbortController()
  remoteStreamAbortController = controller

  try {
    const response = await fetch(`${serverUrl}/api/signage/device/stream?${params.toString()}`, {
      headers: buildRemoteHeaders(serverUrl, {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      }),
      signal: controller.signal,
      cache: "no-store",
    })

    if (!response.ok || !response.body) {
      throw new Error(`Stream failed with status ${response.status}`)
    }

    const decoder = new TextDecoder()
    const reader = response.body.getReader()
    let buffer = ""

    while (!controller.signal.aborted) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const chunks = buffer.split("\n\n")
      buffer = chunks.pop() || ""

      for (const chunk of chunks) {
        const message = parseEventStreamChunk(chunk)
        if (message.event === "update") {
          await syncRemoteDevice()
        }
      }
    }
  } catch (error) {
    if (!controller.signal.aborted && !isQuitting) {
      console.error("Remote signage stream error:", error)
      remoteStreamRestartTimer = setTimeout(() => {
        void startRemoteStream()
      }, 2000)
    }
  }
}

function startRemoteServices() {
  void syncRemoteDevice()
  void startRemoteStream()

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
  }

  heartbeatTimer = setInterval(() => {
    void sendHeartbeat()
  }, 30000)

  void sendHeartbeat()
}

function stopRemoteServices() {
  stopRemoteStream()
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

async function createWindow() {
  const preferredDisplay = getPreferredDisplay()
  const bounds = preferredDisplay?.bounds || { width: 1440, height: 900, x: 0, y: 0 }
  const iconPath = getWindowIconPath()
  const windowIcon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined

  mainWindow = new BrowserWindow({
    width: Math.min(bounds.width, 1440),
    height: Math.min(bounds.height, 900),
    x: bounds.x,
    y: bounds.y,
    minWidth: 1200,
    minHeight: 720,
    backgroundColor: "#050816",
    autoHideMenuBar: true,
    title: APP_TITLE,
    icon: windowIcon,
    frame: false,
    thickFrame: false,
    hasShadow: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.webContents.on("before-input-event", (event, input) => {
    const state = readStore()
    if (!state.fullscreen) return
    if (!shouldExitFullscreenFromInput(input)) return

    event.preventDefault()
    setFullscreenEnabled(false)
  })

  const entry = getRendererEntry()
  if (entry.type === "url") {
    await mainWindow.loadURL(entry.value)
  } else {
    await mainWindow.loadFile(entry.value)
  }
  applyDisplayMode()
}

app.whenReady().then(async () => {
  readStore()

  ipcMain.handle("signage:get-bootstrap", async () => buildBootstrapPayload())
  ipcMain.handle("signage:get-runtime-config", async () => getRuntimeConfig())
  ipcMain.handle("signage:list-displays", async () => getDisplays())
  ipcMain.handle("signage:sync-remote", async () => syncRemoteDevice())
  ipcMain.handle("signage:select-display", async (_, displayId) => {
    writeStore({
      selectedDisplayId: displayId ? String(displayId) : null,
    })
    applyDisplayMode()
    broadcastBootstrap()
    void syncRemoteDevice()
    return buildBootstrapPayload()
  })
  ipcMain.handle("signage:set-fullscreen", async (_, enabled) => {
    return setFullscreenEnabled(enabled)
  })
  ipcMain.handle("signage:set-orientation", async (_, orientation) => {
    writeStore({
      orientation: orientation === "portrait" ? "portrait" : "landscape",
    })
    applyDisplayMode()
    broadcastBootstrap()
    void syncRemoteDevice()
    return buildBootstrapPayload()
  })
  ipcMain.handle("signage:reload-window", async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload()
    }

    return true
  })

  screen.on("display-added", broadcastBootstrap)
  screen.on("display-removed", broadcastBootstrap)
  screen.on("display-metrics-changed", () => {
    applyDisplayMode()
    broadcastBootstrap()
  })

  await createWindow()
  startRemoteServices()

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow()
    }
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("before-quit", () => {
  isQuitting = true
  stopRemoteServices()
})
