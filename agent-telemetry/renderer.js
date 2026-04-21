// DashAdmin Agent - Renderer (UI logic)

let config = {};

async function init() {
  try {
    config = await window.agent.getConfig();
    updateUI();
    
    window.agent.onTelemetryStatus((data) => {
      const dot = document.getElementById('statusDot');
      if (data.ok) {
        dot.className = 'status-dot online';
      } else {
        dot.className = 'status-dot error';
      }
    });
  } catch (e) {
    console.error('Init error:', e);
  }
}

function updateUI() {
  const bound = config.workstationId != null;
  
  document.getElementById('bindCard').classList.toggle('hidden', bound);
  document.getElementById('mainCard').classList.toggle('hidden', !bound);
  document.getElementById('workstationInfo').classList.toggle('hidden', !bound);
  
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  
  if (bound) {
    dot.className = 'status-dot online';
    txt.textContent = 'Подключен';
    document.getElementById('wsName').textContent = config.name || '-';
    document.getElementById('hostname').textContent = config.hostname || '-';
  } else {
    dot.className = 'status-dot offline';
    txt.textContent = 'Не подключен';
  }
}

function resetBindButton() {
  const btn = document.getElementById('bindBtn');
  btn.disabled = false;
  btn.textContent = 'Подключить';
}

async function bind() {
  const code = document.getElementById('codeInput').value.trim();
  if (code.length !== 6) {
    showErr('Код должен быть 6 символов');
    return;
  }
  
  const btn = document.getElementById('bindBtn');
  btn.disabled = true;
  btn.textContent = 'Подключение...';
  hideErr();
  
  try {
    const result = await Promise.race([
      window.agent.bind(code),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Превышено время ожидания (10 сек)')), 10000)
      )
    ]);
    
    config = { ...config, ...result };
    updateUI();
    loadStats();
  } catch (e) {
    showErr(e.message || 'Ошибка подключения');
    resetBindButton();
  }
}

async function unbind() {
  if (!confirm('Отвязать агент?')) return;
  
  try {
    await window.agent.unbind();
    config = { workstationId: null, clubId: null, name: null };
    updateUI();
  } catch (e) {
    console.error('Unbind error:', e);
  }
}

function safeNum(val, fallback = 0) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

function tempClass(temp) {
  const t = safeNum(temp);
  if (t <= 0) return '';
  if (t > 85) return 'temp-hot';
  if (t > 65) return 'temp-warn';
  return 'temp-good';
}

function formatTemp(temp) {
  const t = safeNum(temp);
  if (t <= 0) return 'N/A';
  return t.toFixed(0) + '°C';
}

async function loadStats() {
  try {
    const stats = await window.agent.getStats();
    if (!stats) return;
    
    document.getElementById('cpuModel').textContent = stats.cpu.model || '-';
    document.getElementById('cpuCores').textContent = stats.cpu.cores || '-';
    
    // CPU temp
    const cpuTempEl = document.getElementById('cpuTemp');
    const cpuTemp = safeNum(stats.cpu.temp);
    cpuTempEl.textContent = formatTemp(cpuTemp);
    cpuTempEl.className = 'row-value ' + tempClass(cpuTemp);
    
    // CPU usage
    const usage = safeNum(stats.cpu.usage);
    document.getElementById('cpuUsage').textContent = usage.toFixed(0) + '%';
    document.getElementById('cpuBar').style.width = Math.min(usage, 100) + '%';
    
    // GPU
    if (stats.gpu && stats.gpu.length > 0) {
      document.getElementById('gpuSection').classList.remove('hidden');
      const g = stats.gpu[0];
      document.getElementById('gpuName').textContent = g.name || '-';
      
      // GPU temp
      const gpuTempEl = document.getElementById('gpuTemp');
      const gpuTemp = safeNum(g.temp);
      gpuTempEl.textContent = formatTemp(gpuTemp);
      gpuTempEl.className = 'row-value ' + tempClass(gpuTemp);
      
      // GPU memory
      const memUsed = safeNum(g.memoryUsed);
      const memTotal = safeNum(g.memoryTotal);
      if (memTotal > 0) {
        document.getElementById('gpuMem').textContent = (memUsed / 1e9).toFixed(1) + ' / ' + (memTotal / 1e9).toFixed(0) + ' GB';
      } else {
        document.getElementById('gpuMem').textContent = 'N/A';
      }
    } else {
      document.getElementById('gpuSection').classList.add('hidden');
    }
  } catch (e) {
    console.error('Stats error:', e);
  }
}

function showErr(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideErr() {
  document.getElementById('errorMsg').classList.add('hidden');
}

init();

// Update stats every 10 seconds (reduced from 5s)
setInterval(() => {
  if (config.workstationId) {
    loadStats();
  }
}, 10000);
