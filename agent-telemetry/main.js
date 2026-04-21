// DashAdmin Agent - Electron main process
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const log = require('electron-log');
const si = require('systeminformation');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Configure logging
const logDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
log.transports.file.resolvePathFn = () => path.join(logDir, 'agent.log');
log.transports.file.level = 'info';
log.info('DashAdmin Agent starting...');

// Global state
let mainWindow = null;
let tray = null;
let serverUrl = 'https://www.mydashadmin.ru';
let config = {
  workstationId: null,
  clubId: null,
  name: null,
  hostname: ''
};
let telemetryInterval = null;

// Cache for static data (lives for session)
let cache = {
  cpuModel: null,
  cpuCores: null,
  hostname: null,
  devices: [],
  devicesLastFetch: 0
};

// Get config path
function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

// Load config
function loadConfig() {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      config = { ...config, ...data };
    }
  } catch (e) {
    log.error('Failed to load config:', e);
  }
}

// Save config
function saveConfig() {
  const configPath = getConfigPath();
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (e) {
    log.error('Failed to save config:', e);
  }
}

// Parse command line args
function parseArgs() {
  const args = process.argv.slice(1);
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('-') && args[i].startsWith('http')) {
      serverUrl = args[i];
    }
  }
  
  if (!serverUrl || serverUrl === 'https://www.mydashadmin.ru') {
    serverUrl = process.env.DASHADMIN_SERVER_URL || serverUrl;
  }
  
  log.info('Server URL:', serverUrl);
}

// Create tray icon
function createTray() {
  const iconPath = path.join(__dirname, 'icons', 'icon.ico');
  let trayIcon;
  
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
  } else {
    trayIcon = nativeImage.createEmpty();
  }
  
  tray = new Tray(trayIcon.isEmpty() ? createDefaultIcon() : trayIcon);
  tray.setToolTip('DashAdmin Agent');
  
  updateTrayMenu();
  
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// Create default 16x16 icon
function createDefaultIcon() {
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  
  for (let i = 0; i < size * size; i++) {
    buffer[i * 4] = 74;
    buffer[i * 4 + 1] = 222;
    buffer[i * 4 + 2] = 128;
    buffer[i * 4 + 3] = 255;
  }
  
  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

// Update tray menu
function updateTrayMenu() {
  const isBound = config.workstationId != null;
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Показать панель',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: isBound ? '✓ Подключен' : '⏳ Не подключен',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Выход',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
}

// Create main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 650,
    minWidth: 500,
    maxWidth: 500,
    minHeight: 650,
    maxHeight: 650,
    resizable: false,
    maximizable: false,
    title: 'DashAdmin Agent',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  mainWindow.loadFile('index.html');
  
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

// Get static CPU data (call once)
async function getStaticData() {
  if (!cache.cpuModel) {
    try {
      const cpu = await si.cpu();
      cache.cpuModel = cpu.brand;
      cache.cpuCores = cpu.cores;
    } catch (e) {
      cache.cpuModel = 'Unknown';
      cache.cpuCores = 0;
    }
  }
  
  if (!cache.hostname) {
    try {
      const osInfo = await si.osInfo();
      cache.hostname = osInfo.hostname;
      config.hostname = osInfo.hostname;
    } catch (e) {
      cache.hostname = 'Unknown';
    }
  }
}

// Get dynamic data (CPU load, temps) - devices cached separately
async function getDynamicData() {
  try {
    const [load, cpuTemp, gpu] = await Promise.all([
      si.currentLoad(),
      si.cpuTemperature(),
      si.graphics()
    ]);
    
    let gpuInfo = null;
    if (gpu.controllers && gpu.controllers.length > 0) {
      const c = gpu.controllers[0];
      gpuInfo = {
        name: c.model || 'Unknown',
        temp: c.temperatureGpu || 0,
        usage: c.utilizationGpu || 0,
        memoryUsed: c.memoryUsed || 0,
        memoryTotal: c.memoryTotal || 0
      };
    }
    
    // Get devices only every 30 seconds (expensive USB call)
    let inputDevices = cache.devices;
    const now = Date.now();
    
    // Force refresh on first fetch (when cache is empty)
    const forceRefresh = !cache.devicesLastFetch;
    
    if (forceRefresh || (now - cache.devicesLastFetch) > 30000) {
      try {
        const usb = await si.usb();
        
        inputDevices = [];
        const seenNames = new Set();
        
        // Keywords for input devices - expanded list
        const inputKeywords = ['mouse', 'keyboard', 'keypad', 'touchpad', 'trackpad', 'stylus', 'hid'];
        const excludeKeywords = ['camera', 'webcam', 'audio', 'speaker', 'microphone', 'headset', 'printer', 'scanner'];
        
        const addDevice = (name, type) => {
          if (name && !seenNames.has(name.toLowerCase())) {
            seenNames.add(name.toLowerCase());
            inputDevices.push({ name, type });
          }
        };
        
        // Process USB devices
        if (usb && usb.devices) {
          for (const device of usb.devices) {
            const name = device.name || '';
            const nameLower = name.toLowerCase();
            
            // Skip excluded devices
            if (excludeKeywords.some(k => nameLower.includes(k))) {
              continue;
            }
            
            // Check if it's an input device
            if (inputKeywords.some(k => nameLower.includes(k))) {
              const type = nameLower.includes('keyboard') || nameLower.includes('keypad') ? 'keyboard' : 'mouse';
              addDevice(name, type);
            }
          }
        }
        
        cache.devices = inputDevices;
        cache.devicesLastFetch = now;
        
        log.info('Devices found:', inputDevices.length);
      } catch (e) {
        log.error('USB error:', e);
      }
    }
    
    return {
      cpuUsage: load.currentLoad,
      cpuTemp: cpuTemp?.main || 0,
      gpu: gpuInfo,
      devices: inputDevices
    };
  } catch (e) {
    return { cpuUsage: 0, cpuTemp: 0, gpu: null, devices: cache.devices };
  }
}

// Get system stats - optimized with caching
let lastStats = null;
let lastStatsTime = 0;

async function getStats() {
  const now = Date.now();
  
  // Cache stats for 1 second to avoid rapid calls
  if (lastStats && (now - lastStatsTime) < 1000) {
    return lastStats;
  }
  
  await getStaticData();
  const dynamic = await getDynamicData();
  
  lastStats = {
    cpu: {
      model: cache.cpuModel,
      cores: cache.cpuCores,
      usage: dynamic.cpuUsage,
      temp: dynamic.cpuTemp
    },
    gpu: dynamic.gpu ? [dynamic.gpu] : [],
    devices: dynamic.devices || [],
    hostname: cache.hostname
  };
  
  lastStatsTime = now;
  return lastStats;
}

// Send telemetry to server
async function sendTelemetry() {
  if (!config.workstationId) return;
  
  const stats = await getStats();
  if (!stats) return;
  
  const payload = JSON.stringify({
    workstation_id: config.workstationId,
    hostname: stats.hostname,
    cpu: {
      temp: stats.cpu.temp || 0,
      usage: stats.cpu.usage,
      model_name: stats.cpu.model
    },
    gpu_data: stats.gpu.length > 0 ? stats.gpu : null,
    devices: stats.devices.length > 0 ? stats.devices : null
  });
  
  return new Promise((resolve) => {
    const url = new URL('/api/agents/telemetry', serverUrl);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const req = protocol.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          mainWindow?.webContents.send('telemetry-status', { ok: true });
        } else {
          mainWindow?.webContents.send('telemetry-status', { ok: false, error: data });
        }
        resolve();
      });
    });
    
    req.on('error', () => resolve());
    req.write(payload);
    req.end();
  });
}

// Register agent
async function registerAgent(code) {
  await getStaticData();
  const hostname = cache.hostname || 'Unknown';
  const payload = JSON.stringify({ binding_code: code, hostname });
  
  return new Promise((resolve, reject) => {
    const url = new URL('/api/agents/register', serverUrl);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const req = protocol.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(data);
            config.workstationId = result.workstation_id;
            config.clubId = result.club_id;
            config.name = result.name;
            saveConfig();
            updateTrayMenu();
            startTelemetry();
            resolve(result);
          } catch (e) {
            reject(new Error('Invalid response'));
          }
        } else {
          reject(new Error(data));
        }
      });
    });
    
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Unbind agent
async function unbindAgent() {
  if (!config.workstationId) return;
  
  const payload = JSON.stringify({ workstation_id: config.workstationId });
  
  return new Promise((resolve) => {
    const url = new URL('/api/agents/unbind', serverUrl);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const req = protocol.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, () => {
      config.workstationId = null;
      config.clubId = null;
      config.name = null;
      cache.devices = [];
      cache.devicesLastFetch = 0;
      saveConfig();
      stopTelemetry();
      updateTrayMenu();
      resolve();
    });
    
    req.on('error', resolve);
    req.write(payload);
    req.end();
  });
}

// Start telemetry loop (every 10 seconds - reduced from 5s to lower CPU usage)
function startTelemetry() {
  if (telemetryInterval) clearInterval(telemetryInterval);
  sendTelemetry();
  telemetryInterval = setInterval(sendTelemetry, 10000);
}

// Stop telemetry loop
function stopTelemetry() {
  if (telemetryInterval) {
    clearInterval(telemetryInterval);
    telemetryInterval = null;
  }
}

// IPC Handlers
ipcMain.handle('get-config', () => ({
  workstationId: config.workstationId,
  clubId: config.clubId,
  name: config.name,
  hostname: config.hostname
}));

ipcMain.handle('bind-agent', async (_, code) => registerAgent(code));
ipcMain.handle('unbind-agent', async () => unbindAgent());
ipcMain.handle('get-stats', async () => getStats());
ipcMain.handle('quit-app', () => {
  app.isQuitting = true;
  app.quit();
});

// App events
app.whenReady().then(async () => {
  parseArgs();
  loadConfig();
  await getStaticData(); // Pre-load static data
  createTray();
  createWindow();
  
  if (config.workstationId) {
    startTelemetry();
  }
});

app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopTelemetry();
  log.info('Agent stopped');
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});
