// DashAdmin Agent - Preload script (secure bridge)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agent', {
  // Get current config
  getConfig: () => ipcRenderer.invoke('get-config'),
  
  // Bind agent with code
  bind: (code) => ipcRenderer.invoke('bind-agent', code),
  
  // Unbind agent
  unbind: () => ipcRenderer.invoke('unbind-agent'),
  
  // Get system stats
  getStats: () => ipcRenderer.invoke('get-stats'),
  
  // Quit application
  quit: () => ipcRenderer.invoke('quit-app'),
  
  // Listen to telemetry status updates
  onTelemetryStatus: (callback) => {
    ipcRenderer.on('telemetry-status', (_, data) => callback(data));
  }
});
