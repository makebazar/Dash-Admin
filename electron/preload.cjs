const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("electronSignage", {
  getBootstrap: () => ipcRenderer.invoke("signage:get-bootstrap"),
  getRuntimeConfig: () => ipcRenderer.invoke("signage:get-runtime-config"),
  listDisplays: () => ipcRenderer.invoke("signage:list-displays"),
  syncRemote: () => ipcRenderer.invoke("signage:sync-remote"),
  selectDisplay: (displayId) => ipcRenderer.invoke("signage:select-display", displayId),
  setFullscreen: (enabled) => ipcRenderer.invoke("signage:set-fullscreen", enabled),
  setOrientation: (orientation) => ipcRenderer.invoke("signage:set-orientation", orientation),
  reloadWindow: () => ipcRenderer.invoke("signage:reload-window"),
  reportCurrentSlide: (currentSlideId) =>
    ipcRenderer.invoke("signage:report-current-slide", currentSlideId),
  onBootstrapUpdated: (callback) => {
    const listener = (_, payload) => callback(payload)
    ipcRenderer.on("signage:bootstrap-updated", listener)

    return () => {
      ipcRenderer.removeListener("signage:bootstrap-updated", listener)
    }
  },
})
