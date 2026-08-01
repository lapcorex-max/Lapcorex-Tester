const $ = (selector) => document.querySelector(selector);
const modal = $('#test-modal');
const content = $('#modal-content');
let webcamStream, micStream, audioContext, animationId, keyboardHandler;
let visitorEstimate = Math.floor(Math.random() * 75001) + 25000;
const startedTests = new Set();
const testNames = { keyboard: 'Keyboard Test', mouse: 'Mouse / Touchpad Test', display: 'LCD / Display Test', speaker: 'Speaker Test', microphone: 'Microphone Test', webcam: 'Webcam Test', system: 'System Information', battery: 'Battery Test', wifi: 'WiFi / Network Test' };

function updateVisitors() {
  visitorEstimate = Math.max(25000, Math.min(100000, visitorEstimate + Math.floor(Math.random() * 7) - 3));
  const count = $('#visitor-count');
  if (count) count.textContent = visitorEstimate;
}

function updateClock() {
  const now = new Date();
  $('#current-time').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  $('#current-date').textContent = now.toLocaleDateString([], { day: '2-digit', month: 'long', year: 'numeric' });
  $('#current-day').textContent = now.toLocaleDateString([], { weekday: 'long' });
  const uptime = $('#uptime');
  if (uptime) {
    const seconds = Math.floor(performance.now() / 1000);
    const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor(seconds % 3600 / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    uptime.textContent = `${hours}:${minutes}:${secs}`;
  }
}

function browserName() {
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return 'Microsoft Edge';
  if (ua.includes('Chrome/')) return 'Google Chrome';
  if (ua.includes('Firefox/')) return 'Firefox';
  return 'Web Browser';
}

async function loadDashboard() {
  $('#screen-size').textContent = `${screen.width} × ${screen.height}`;
  $('#browser-name').textContent = browserName();
  $('#cpu-threads').textContent = `${navigator.hardwareConcurrency || '—'} Threads`;
  $('#ram-size').textContent = `${navigator.deviceMemory || '—'} GB`;
  $('#network-state').textContent = navigator.onLine ? 'Online' : 'Offline';
  const conn = navigator.connection;
  $('#network-type').textContent = conn?.effectiveType ? `${conn.effectiveType.toUpperCase()} connection` : 'Connected';
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    $('#storage-size').textContent = estimate.quota ? `${Math.round(estimate.quota / 1024 ** 3)} GB` : 'Available';
  }
  if (navigator.getBattery) {
    const batteryStatus = await navigator.getBattery();
    const show = () => {
      $('#battery-level').textContent = `${Math.round(batteryStatus.level * 100)}%`;
      $('#battery-state').textContent = batteryStatus.charging ? 'Charging' : 'On battery';
    };
    show();
    batteryStatus.addEventListener('levelchange', show);
    batteryStatus.addEventListener('chargingchange', show);
  } else {
    $('#battery-level').textContent = 'Not supported';
  }
}

function closeModal() {
  stopMedia();
  if (keyboardHandler) {
    window.removeEventListener('keydown', keyboardHandler);
    keyboardHandler = null;
  }
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function openModal(html) {
  content.innerHTML = html;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function stopMedia() {
  webcamStream?.getTracks().forEach((track) => track.stop());
  micStream?.getTracks().forEach((track) => track.stop());
  webcamStream = micStream = null;
  cancelAnimationFrame(animationId);
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}

const infoCard = (title, rows) => `<section class="info-card"><h3>${title}</h3>${rows.map(([label, value]) => `<div><span>${label}</span><b>${value ?? 'Not available'}</b></div>`).join('')}</section>`;
const bytes = (value) => value == null ? 'Not available' : `${(value / 1024 ** 3).toFixed(2)} GB`;

async function systemInfo() {
  openModal(`<h2>Advanced System Information</h2><p>Live diagnostics collected locally by your browser. Some hardware values are restricted by browser privacy settings.</p><div class="advanced-grid" id="system-details"><p>Collecting system information…</p></div>`);
  let gpu = 'Not available', gpuVendor = 'Not available', storage = {}, ua = {};
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      gpuVendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    }
  } catch {}
  try { storage = await navigator.storage?.estimate() || {}; } catch {}
  try { ua = await navigator.userAgentData?.getHighEntropyValues(['architecture', 'bitness', 'model', 'platformVersion', 'fullVersionList']) || {}; } catch {}
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const orientation = screen.orientation?.type || 'Not available';
  const language = [...new Set(navigator.languages || [navigator.language])].join(', ');
  const details = $('#system-details');
  if (!details) return;
  details.innerHTML = [
    infoCard('Device & Browser', [['Operating system', ua.platform || navigator.platform], ['Platform version', ua.platformVersion], ['Architecture', ua.architecture ? `${ua.architecture} ${ua.bitness || ''}` : null], ['Browser', browserName()], ['User agent', navigator.userAgent], ['Languages', language], ['Cookies enabled', navigator.cookieEnabled ? 'Yes' : 'No'], ['Do Not Track', navigator.doNotTrack || 'Not set']]),
    infoCard('Processor & Graphics', [['Logical CPU cores', navigator.hardwareConcurrency || null], ['Device memory', navigator.deviceMemory ? `${navigator.deviceMemory} GB` : null], ['GPU vendor', gpuVendor], ['GPU renderer', gpu], ['WebGL', gpu === 'Not available' ? 'Unavailable' : 'Supported'], ['JavaScript heap limit', performance.memory ? bytes(performance.memory.jsHeapSizeLimit) : null], ['Heap in use', performance.memory ? bytes(performance.memory.usedJSHeapSize) : null]]),
    infoCard('Display & Input', [['Resolution', `${screen.width} × ${screen.height}`], ['Available display', `${screen.availWidth} × ${screen.availHeight}`], ['Color depth', `${screen.colorDepth}-bit`], ['Pixel ratio', window.devicePixelRatio], ['Orientation', orientation], ['Touch points', navigator.maxTouchPoints || 0], ['Pointer support', matchMedia('(pointer:fine)').matches ? 'Mouse / touchpad' : 'Touch or unknown']]),
    infoCard('Network & Storage', [['Connection status', navigator.onLine ? 'Online' : 'Offline'], ['Connection type', connection?.effectiveType?.toUpperCase() || null], ['Estimated downlink', connection?.downlink ? `${connection.downlink} Mbps` : null], ['Estimated latency', connection?.rtt ? `${connection.rtt} ms` : null], ['Storage quota', bytes(storage.quota)], ['Storage used', bytes(storage.usage)], ['Service worker', ('serviceWorker' in navigator) ? 'Supported' : 'Not supported']]),
    infoCard('Regional Settings', [['Time zone', zone], ['Local time', new Date().toLocaleString()], ['Locale', navigator.language], ['Online since page opened', `${Math.round(performance.now() / 1000)} seconds`], ['Secure context', window.isSecureContext ? 'Yes' : 'No'], ['PDF viewer', navigator.pdfViewerEnabled ? 'Supported' : 'Not available']])
  ].join('');
}

function keyboard() {
  const key = (label, code, wide = '') => `<span class="key ${wide}" data-code="${code}">${label}</span>`;
  const row = (items) => `<div class="key-row">${items.join('')}</div>`;
  const layout = [
    row([key('Esc', 'Escape'), ...['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].map((item) => key(item, item))]),
    row([key('`', 'Backquote'), ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((item) => key(item, `Digit${item}`)), key('-', 'Minus'), key('=', 'Equal'), key('Backspace', 'Backspace', 'back')]),
    row([key('Tab', 'Tab', 'tab'), ...['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((item) => key(item, `Key${item}`)), key('[', 'BracketLeft'), key(']', 'BracketRight'), key('\\', 'Backslash', 'wide')]),
    row([key('Caps Lock', 'CapsLock', 'caps'), ...['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((item) => key(item, `Key${item}`)), key(';', 'Semicolon'), key("'", 'Quote'), key('Enter', 'Enter', 'enter')]),
    row([key('Shift', 'ShiftLeft', 'shift'), ...['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map((item) => key(item, `Key${item}`)), key(',', 'Comma'), key('.', 'Period'), key('/', 'Slash'), key('Shift', 'ShiftRight', 'shift')]),
    row([key('Ctrl', 'ControlLeft', 'ctrl'), key('Win', 'MetaLeft', 'win'), key('Alt', 'AltLeft', 'alt'), key('Space', 'Space', 'space'), key('Alt', 'AltRight', 'alt'), key('Ctrl', 'ControlRight', 'ctrl'), key('←', 'ArrowLeft', 'arrow'), key('↑', 'ArrowUp', 'arrow'), key('↓', 'ArrowDown', 'arrow'), key('→', 'ArrowRight', 'arrow')])
  ].join('');
  openModal(`<h2>Full Keyboard Test</h2><p>Press every key. Detected keys will glow purple.</p><div class="keyboard-layout">${layout}</div><p id="key-result">0 / ${layout.match(/data-code=/g).length} keys detected</p>`);
  document.activeElement?.blur();
  const seen = new Set();
  const markKey = (code) => {
    const target = content.querySelector(`[data-code="${code}"]`);
    if (!target) return false;
    target.classList.add('active');
    seen.add(code);
    $('#key-result').textContent = `${seen.size} / ${content.querySelectorAll('[data-code]').length} keys detected`;
    return true;
  };
  keyboardHandler = (event) => { if (markKey(event.code)) event.preventDefault(); };
  content.querySelectorAll('.key[data-code]').forEach((item) => item.addEventListener('click', () => markKey(item.dataset.code)));
  window.addEventListener('keydown', keyboardHandler);
}

function mouse() {
  openModal(`<h2>Mouse / Touchpad Test</h2><p>Move, click, double-click and scroll inside the zone.</p><div class="test-zone" id="mouse-zone"><h3 id="mouse-status">Move your pointer here</h3><p id="mouse-pos">X: 0 · Y: 0</p></div>`);
  const zone = $('#mouse-zone');
  zone.onmousemove = (event) => {
    const rect = zone.getBoundingClientRect();
    $('#mouse-pos').textContent = `X: ${Math.round(event.clientX - rect.left)} · Y: ${Math.round(event.clientY - rect.top)}`;
    $('#mouse-status').textContent = 'Movement detected ✓';
  };
  zone.onmousedown = (event) => $('#mouse-status').textContent = ['Left click ✓', 'Middle click ✓', 'Right click ✓'][event.button] || 'Click detected';
  zone.onwheel = (event) => { $('#mouse-status').textContent = event.deltaY > 0 ? 'Scroll down ✓' : 'Scroll up ✓'; event.preventDefault(); };
  zone.oncontextmenu = (event) => event.preventDefault();
}

/* Display Diagnostic: each test is a self-contained, valid popup document. */
function display() {
  openModal(`
    <h2>LCD / Display Diagnostic</h2>
    <p>Open a test in a clean, distraction-free window. It will request fullscreen automatically; tap/click once if your browser asks for a gesture.</p>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px;margin-top:25px;">
      <button class="action-btn" data-display-test="color">🎨 Color / RGB Test</button>
      <button class="action-btn" data-display-test="dead">◼ Dead Pixel Test</button>
      <button class="action-btn" data-display-test="dot">• Pixel Dot Test</button>
      <button class="action-btn" data-display-test="touch">👆 Touch Screen Test</button>
      <button class="action-btn" data-display-test="grid" style="grid-column:1 / -1;">▦ Grid / Alignment Test</button>
    </div>
    <p style="margin-top:18px">Controls: <b>Esc</b> or <b>Back</b> exits; <b>Space</b>, <b>←</b>, and <b>→</b> cycle applicable patterns.</p>`);
  content.querySelectorAll('[data-display-test]').forEach((button) => button.addEventListener('click', () => openDisplayTest(button.dataset.displayTest)));
}

function openDisplayTest(test) {
  const tests = {
    color: { title: 'Color / RGB Test', label: 'Color / RGB Test', hint: 'Click, Space, or arrow keys to cycle colors.', kind: 'color' },
    dead: { title: 'Dead Pixel Test', label: 'Dead Pixel Test', hint: 'A dense pixel pattern makes isolated stuck/dead pixels easier to spot. Click or use arrow keys to change the pattern.', kind: 'dead' },
    dot: { title: 'Pixel Dot Test', label: 'Pixel Dot Test', hint: 'Use Space or arrow keys to change the dot color.', kind: 'dot' },
    touch: { title: 'Touch Screen Test', label: 'Touch Screen Test', hint: 'Draw anywhere with one or more fingers, a pen, or a mouse.', kind: 'touch' },
    grid: { title: 'Grid / Alignment Test', label: 'Grid / Alignment Test', hint: 'Use Space or arrow keys to change grid contrast.', kind: 'grid' }
  };
  const config = tests[test];
  if (!config) return;

  // Calling window.open synchronously in the button click preserves the user gesture and avoids popup blocking.
  const win = window.open('', '_blank');
  if (!win) {
    openModal('<h2>Popup blocked</h2><p>Please allow popups for this site, then start the display test again.</p>');
    return;
  }

  const payload = JSON.stringify(config).replace(/</g, '\\u003c');
  win.document.open();
  win.document.write(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${config.title}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { width:100%; height:100%; margin:0; overflow:hidden; background:#000; font-family:Arial,Helvetica,sans-serif; }
  #stage { position:fixed; inset:0; display:grid; place-items:center; background:#000; color:#fff; touch-action:none; user-select:none; }
  #back { position:fixed; top:max(16px,env(safe-area-inset-top)); left:max(16px,env(safe-area-inset-left)); z-index:20; border:1px solid rgba(255,255,255,.35); border-radius:10px; background:rgba(12,12,18,.76); color:#fff; padding:10px 15px; font:600 15px/1 Arial,sans-serif; cursor:pointer; backdrop-filter:blur(9px); }
  #back:hover, #back:focus-visible { background:#962eff; outline:2px solid #fff; outline-offset:2px; }
  #label { position:fixed; right:max(16px,env(safe-area-inset-right)); bottom:max(16px,env(safe-area-inset-bottom)); z-index:10; max-width:min(540px,calc(100vw - 32px)); padding:8px 11px; border-radius:8px; background:rgba(0,0,0,.58); color:#fff; font:13px/1.35 Arial,sans-serif; text-align:right; opacity:.86; transition:opacity .2s; }
  #stage.color { cursor:crosshair; }
  #dot { width:3px; height:3px; border-radius:50%; background:#fff; box-shadow:0 0 13px 4px rgba(255,255,255,.72); }
  #touch-canvas { position:absolute; inset:0; width:100%; height:100%; cursor:crosshair; }
  #touch-count { position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); color:#fff; font:700 clamp(28px,7vw,88px)/1 Arial,sans-serif; text-shadow:0 2px 9px #000; pointer-events:none; text-align:center; }
  #touch-count small { display:block; margin-top:12px; font:400 clamp(14px,2vw,21px)/1.3 Arial,sans-serif; }
  #stage.grid { background-color:#111; background-image:linear-gradient(rgba(255,255,255,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.18) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.36) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.36) 1px,transparent 1px); background-size:10px 10px,10px 10px,100px 100px,100px 100px; }
  #cross-h, #cross-v { position:absolute; background:rgba(255,64,64,.78); pointer-events:none; } #cross-h { height:1px; width:100%; } #cross-v { width:1px; height:100%; }
</style>
</head>
<body>
<button id="back" type="button" aria-label="Exit display test">← Back</button>
<main id="stage" tabindex="0"><div id="label"></div></main>
<script>
(() => {
  const config = ${payload};
  const stage = document.getElementById('stage');
  const label = document.getElementById('label');
  const back = document.getElementById('back');
  let colorIndex = 0;
  const colors = [
    ['Black', '#000000'], ['White', '#ffffff'], ['Red', '#ff0000'], ['Green', '#00ff00'],
    ['Blue', '#0000ff'], ['Yellow', '#ffff00'], ['Cyan', '#00ffff'], ['Magenta', '#ff00ff'], ['Gray', '#808080']
  ];
  const gridThemes = [
    ['Dark grid', '#111', 'rgba(255,255,255,.18)', 'rgba(255,255,255,.36)'],
    ['Light grid', '#f7f7f7', 'rgba(0,0,0,.18)', 'rgba(0,0,0,.38)'],
    ['Red grid', '#100000', 'rgba(255,70,70,.28)', 'rgba(255,70,70,.5)']
  ];
  const deadPatterns = [
    ['Black / white pixels', '#000', '#fff', 2],
    ['White / black pixels', '#fff', '#000', 2],
    ['Red / black pixels', '#000', '#ff2020', 2],
    ['Green / black pixels', '#000', '#20ff50', 2],
    ['Blue / black pixels', '#000', '#2380ff', 2],
    ['Large contrast grid', '#080808', '#f5f5f5', 6]
  ];
  let gridIndex = 0;
  let deadIndex = 0;

  function setLabel(text, darkText = false) { label.textContent = text; label.style.color = darkText ? '#111' : '#fff'; label.style.background = darkText ? 'rgba(255,255,255,.62)' : 'rgba(0,0,0,.58)'; }
  function requestFullScreen() {
    const request = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
    if (request && !document.fullscreenElement && !document.webkitFullscreenElement) request.call(document.documentElement).catch(() => setLabel('Fullscreen was not granted. Tap the test area to try again.'));
  }
  function leave() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if ((document.fullscreenElement || document.webkitFullscreenElement) && exit) exit.call(document).catch(() => {});
    window.close();
  }
  back.addEventListener('pointerdown', (event) => event.stopPropagation());
  back.addEventListener('click', (event) => { event.stopPropagation(); leave(); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); leave(); return; }
    if ([' ', 'ArrowRight', 'ArrowLeft'].includes(event.key) && config.kind !== 'touch') { event.preventDefault(); cycle(event.key === 'ArrowLeft' ? -1 : 1); }
  });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) label.style.opacity = '.86'; });
  stage.addEventListener('pointerdown', () => requestFullScreen(), { once:true });

  function showColor() {
    const [name, color] = colors[colorIndex];
    stage.className = 'color';
    stage.style.background = color;
    const darkText = color === '#ffffff' || color === '#ffff00' || color === '#00ffff' || color === '#808080';
    setLabel(config.label + ': ' + name + ' — ' + config.hint, darkText);
  }
  function showDot() {
    const [name, color] = colors[colorIndex];
    stage.className = 'color'; stage.style.background = '#000';
    stage.innerHTML = '<div id="dot"></div>';
    const dot = document.getElementById('dot'); dot.style.background = color; dot.style.boxShadow = '0 0 13px 4px ' + color;
    setLabel('Pixel Dot Test: ' + name + ' dot — ' + config.hint);
  }
  function showDead() {
    const [name, base, pixel, size] = deadPatterns[deadIndex];
    stage.className = 'dead';
    stage.innerHTML = '';
    stage.style.backgroundColor = base;
    stage.style.backgroundImage = 'linear-gradient(45deg,' + pixel + ' 25%,transparent 25%,transparent 75%,' + pixel + ' 75%),linear-gradient(45deg,' + pixel + ' 25%,transparent 25%,transparent 75%,' + pixel + ' 75%)';
    stage.style.backgroundSize = (size * 2) + 'px ' + (size * 2) + 'px';
    stage.style.backgroundPosition = '0 0,' + size + 'px ' + size + 'px';
    setLabel('Dead Pixel Test: ' + name + ' — ' + config.hint);
  }
  function showGrid() {
    const [name, background, small, large] = gridThemes[gridIndex];
    stage.className = 'grid'; stage.innerHTML = '<i id="cross-h"></i><i id="cross-v"></i>';
    stage.style.backgroundColor = background;
    stage.style.backgroundImage = 'linear-gradient(' + small + ' 1px,transparent 1px),linear-gradient(90deg,' + small + ' 1px,transparent 1px),linear-gradient(' + large + ' 1px,transparent 1px),linear-gradient(90deg,' + large + ' 1px,transparent 1px)';
    setLabel('Grid / Alignment Test: ' + name + ' — ' + config.hint);
  }
  function showTouch() {
    stage.className = ''; stage.style.background = '#050509';
    stage.innerHTML = '<canvas id="touch-canvas"></canvas><div id="touch-count">0<small>active touch points</small></div>';
    const canvas = document.getElementById('touch-canvas'); const ctx = canvas.getContext('2d'); const count = document.getElementById('touch-count');
    const active = new Map();
    function resize() { const ratio = devicePixelRatio || 1; canvas.width = innerWidth * ratio; canvas.height = innerHeight * ratio; canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px'; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 6; }
    function draw(event) { const previous = active.get(event.pointerId); if (!previous) return; ctx.strokeStyle = 'hsl(' + ((event.pointerId * 53) % 360) + ' 100% 64%)'; ctx.beginPath(); ctx.moveTo(previous.x, previous.y); ctx.lineTo(event.clientX, event.clientY); ctx.stroke(); active.set(event.pointerId, { x:event.clientX, y:event.clientY }); }
    function update() { count.firstChild.textContent = active.size; }
    resize(); addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', (event) => { canvas.setPointerCapture(event.pointerId); active.set(event.pointerId, { x:event.clientX, y:event.clientY }); update(); });
    canvas.addEventListener('pointermove', draw);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => canvas.addEventListener(type, (event) => { active.delete(event.pointerId); update(); }));
    setLabel('Touch Screen Test — ' + config.hint + ' Press C to clear.');
    document.addEventListener('keydown', (event) => { if (event.key.toLowerCase() === 'c') ctx.clearRect(0, 0, innerWidth, innerHeight); });
  }
  function cycle(direction) {
    if (config.kind === 'color') { colorIndex = (colorIndex + direction + colors.length) % colors.length; showColor(); }
    if (config.kind === 'dot') { colorIndex = (colorIndex + direction + colors.length) % colors.length; showDot(); }
    if (config.kind === 'dead') { deadIndex = (deadIndex + direction + deadPatterns.length) % deadPatterns.length; showDead(); }
    if (config.kind === 'grid') { gridIndex = (gridIndex + direction + gridThemes.length) % gridThemes.length; showGrid(); }
  }
  if (config.kind === 'color') { showColor(); stage.addEventListener('click', () => cycle(1)); }
  if (config.kind === 'dot') { showDot(); stage.addEventListener('click', () => cycle(1)); }
  if (config.kind === 'dead') { showDead(); stage.addEventListener('click', () => cycle(1)); }
  if (config.kind === 'grid') { showGrid(); stage.addEventListener('click', () => cycle(1)); }
  if (config.kind === 'touch') showTouch();
  requestFullScreen();
})();
<\/script>
</body>
</html>`);
  win.document.close();
}

function speaker() {
  openModal(`<h2>Speaker Test</h2><p>Play a short, comfortable tone through each channel.</p><button class="action-btn" data-tone="-1">◀ Left</button><button class="action-btn" data-tone="0">◉ Both</button><button class="action-btn" data-tone="1">Right ▶</button><p id="speaker-status">Choose a channel, then listen for the tone.</p>`);
  content.querySelectorAll('[data-tone]').forEach((button) => button.onclick = () => {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audioContext = new Audio();
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain(), panner = audioContext.createStereoPanner();
    oscillator.frequency.value = 440; gain.gain.value = .1; panner.pan.value = Number(button.dataset.tone);
    oscillator.connect(gain).connect(panner).connect(audioContext.destination); oscillator.start();
    $('#speaker-status').textContent = 'Tone playing…';
    setTimeout(() => { oscillator.stop(); audioContext.close(); audioContext = null; $('#speaker-status').textContent = 'Tone complete.'; }, 1200);
  });
}

async function webcam() {
  openModal(`<h2>Webcam Test</h2><p>Allow camera access to see the live preview.</p><button class="action-btn" id="start-camera">Start camera</button><p id="camera-status">Camera is not started.</p><video id="camera" autoplay muted playsinline style="width:100%;border-radius:13px;display:none;background:#000"></video>`);
  $('#start-camera').onclick = async () => {
    try { webcamStream = await navigator.mediaDevices.getUserMedia({ video: true }); $('#camera').srcObject = webcamStream; $('#camera').style.display = 'block'; $('#camera-status').textContent = 'Camera is working ✓'; }
    catch { $('#camera-status').textContent = 'Camera permission was not granted.'; }
  };
}

async function microphone() {
  openModal(`<h2>Microphone Test</h2><p>Allow access and speak into your microphone.</p><button class="action-btn" id="start-mic">Start microphone</button><div class="meter"><i id="mic-meter"></i></div><p id="mic-status">Microphone is not started.</p>`);
  $('#start-mic').onclick = async () => {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Audio = window.AudioContext || window.webkitAudioContext;
      audioContext = new Audio();
      const analyser = audioContext.createAnalyser();
      audioContext.createMediaStreamSource(micStream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => { analyser.getByteTimeDomainData(data); let total = 0; data.forEach((value) => total += (value - 128) ** 2); $('#mic-meter').style.width = `${Math.min(100, Math.sqrt(total / data.length) * 2)}%`; animationId = requestAnimationFrame(tick); };
      tick(); $('#mic-status').textContent = 'Microphone connected ✓';
    } catch { $('#mic-status').textContent = 'Microphone permission was not granted.'; }
  };
}

async function battery() {
  openModal(`<h2>Advanced Battery Information</h2><p>Live battery readings from your browser.</p><div id="battery-detail" class="advanced-grid"><p>Reading battery status…</p></div>`);
  if (!navigator.getBattery) { $('#battery-detail').innerHTML = '<div class="test-zone">Battery information is not exposed by this browser. Try Chrome or Edge on a laptop.</div>'; return; }
  const batteryStatus = await navigator.getBattery();
  const render = () => {
    const target = $('#battery-detail'); if (!target) return;
    const percent = Math.round(batteryStatus.level * 100);
    const time = (seconds) => isFinite(seconds) ? `${Math.floor(seconds / 3600)}h ${Math.round(seconds % 3600 / 60)}m` : 'Not available';
    const health = percent > 75 ? 'Good' : percent > 30 ? 'Moderate' : 'Low';
    target.innerHTML = `<section class="battery-hero"><strong>${percent}%</strong><div><b>${batteryStatus.charging ? 'Charging' : 'Running on battery'}</b><small>${health} current charge level</small></div></section>${infoCard('Battery status', [['Current charge', `${percent}%`], ['Power source', batteryStatus.charging ? 'AC adapter connected' : 'Battery power'], ['Charging time remaining', batteryStatus.charging ? time(batteryStatus.chargingTime) : 'Not charging'], ['Estimated time remaining', !batteryStatus.charging ? time(batteryStatus.dischargingTime) : 'Charging'], ['Charge level assessment', health], ['Live updates', 'Enabled']])}<p class="privacy-note">Note: battery model, cycle count, temperature and true health/capacity are not available to normal websites. Use a manufacturer utility for those values.</p>`;
  };
  render();
  ['chargingchange', 'levelchange', 'chargingtimechange', 'dischargingtimechange'].forEach((event) => batteryStatus.addEventListener(event, render));
}

function wifi() {
  openModal(`<h2>WiFi / Network Test</h2><p>Checking your browser’s current network connection.</p><div class="test-zone"><b>Status:</b> ${navigator.onLine ? 'Online ✓' : 'Offline'}<br><b>Type:</b> ${navigator.connection?.effectiveType || 'Unknown'}<br><b>Estimated speed:</b> ${navigator.connection?.downlink ? `${navigator.connection.downlink} Mbps` : 'Not available'}<br><b>Latency:</b> ${navigator.connection?.rtt ? `${navigator.connection.rtt} ms` : 'Not available'}</div>`);
}

async function report() {
  const escapeHtml = (value) => String(value ?? 'Not available').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  let batteryData = { level: 'Not available', state: 'Not supported', remaining: 'Not available' };
  let storageData = { used: 'Not available', quota: 'Not available' };
  try {
    const batteryStatus = await navigator.getBattery?.();
    if (batteryStatus) {
      const minutes = batteryStatus.charging ? batteryStatus.chargingTime : batteryStatus.dischargingTime;
      batteryData = {
        level: `${Math.round(batteryStatus.level * 100)}%`,
        state: batteryStatus.charging ? 'Charging' : 'Running on battery',
        remaining: isFinite(minutes) ? `${Math.floor(minutes / 3600)}h ${Math.round(minutes % 3600 / 60)}m` : 'Not available'
      };
    }
  } catch {}
  try {
    const estimate = await navigator.storage?.estimate();
    if (estimate) storageData = { used: estimate.usage ? `${(estimate.usage / 1024 ** 3).toFixed(2)} GB` : '0 GB', quota: estimate.quota ? `${(estimate.quota / 1024 ** 3).toFixed(2)} GB` : 'Not available' };
  } catch {}
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const tested = Object.entries(testNames).map(([key, name]) => `<tr><td>${escapeHtml(name)}</td><td class="${startedTests.has(key) ? 'pass' : 'muted'}">${startedTests.has(key) ? 'Opened / checked' : 'Not run'}</td></tr>`).join('');
  const generated = new Date();
  const reportHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lapcorex Diagnostic Report</title><style>body{margin:0;background:#f2f3f8;color:#17203a;font:14px/1.45 Arial,sans-serif}.page{max-width:850px;margin:28px auto;background:#fff;box-shadow:0 4px 26px #17203a24}.head{padding:30px 36px;background:linear-gradient(120deg,#10052b,#5d1a9e);color:#fff}.head h1{margin:0;font-size:30px;letter-spacing:.5px}.head p{margin:6px 0 0;color:#e4caff}.content{padding:30px 36px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.card{border:1px solid #dce0ec;border-radius:10px;padding:16px}.card h2{font-size:14px;margin:0 0 11px;color:#741ecc;text-transform:uppercase;letter-spacing:.7px}.row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid #edf0f6}.row:first-of-type{border-top:0}.row span{color:#667085}.row b{text-align:right;word-break:break-word}table{width:100%;border-collapse:collapse;border:1px solid #dce0ec;border-radius:10px;overflow:hidden;margin-top:22px}th,td{padding:11px 13px;text-align:left;border-bottom:1px solid #e7eaf2}th{background:#f5f1fb;color:#5b168f;font-size:12px;text-transform:uppercase;letter-spacing:.5px}.pass{color:#087d3e;font-weight:bold}.muted{color:#7b8498}.note{margin-top:22px;padding:13px 15px;border-left:4px solid #8c31da;background:#faf6ff;color:#625576}.foot{padding:18px 36px;background:#f7f8fb;color:#687187;font-size:12px}@media(max-width:620px){.page{margin:0}.grid{grid-template-columns:1fr}.head,.content,.foot{padding-left:20px;padding-right:20px}}@media print{body{background:#fff}.page{margin:0;box-shadow:none;max-width:none}}</style></head><body><main class="page"><header class="head"><h1>LAPCOREX DIAGNOSTIC REPORT</h1><p>Generated locally in your browser • ${escapeHtml(generated.toLocaleString())}</p></header><section class="content"><div class="grid"><section class="card"><h2>Device & Browser</h2><div class="row"><span>Platform</span><b>${escapeHtml(navigator.platform)}</b></div><div class="row"><span>Browser</span><b>${escapeHtml(browserName())}</b></div><div class="row"><span>Logical CPU cores</span><b>${escapeHtml(navigator.hardwareConcurrency || 'Not available')}</b></div><div class="row"><span>Device memory</span><b>${escapeHtml(navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'Not available')}</b></div></section><section class="card"><h2>Display</h2><div class="row"><span>Resolution</span><b>${screen.width} × ${screen.height}</b></div><div class="row"><span>Available display</span><b>${screen.availWidth} × ${screen.availHeight}</b></div><div class="row"><span>Color depth</span><b>${escapeHtml(screen.colorDepth)}-bit</b></div><div class="row"><span>Touch points</span><b>${escapeHtml(navigator.maxTouchPoints || 0)}</b></div></section><section class="card"><h2>Battery</h2><div class="row"><span>Current charge</span><b>${escapeHtml(batteryData.level)}</b></div><div class="row"><span>Power state</span><b>${escapeHtml(batteryData.state)}</b></div><div class="row"><span>Estimated time</span><b>${escapeHtml(batteryData.remaining)}</b></div></section><section class="card"><h2>Network & Storage</h2><div class="row"><span>Connection</span><b>${navigator.onLine ? 'Online' : 'Offline'}</b></div><div class="row"><span>Network type</span><b>${escapeHtml(connection?.effectiveType?.toUpperCase() || 'Not available')}</b></div><div class="row"><span>Storage used</span><b>${escapeHtml(storageData.used)}</b></div><div class="row"><span>Storage quota</span><b>${escapeHtml(storageData.quota)}</b></div></section></div><table><thead><tr><th>Diagnostic test</th><th>Status</th></tr></thead><tbody>${tested}</tbody></table><p class="note"><b>Important:</b> This browser report contains only values websites are allowed to access. SSD SMART health, battery cycle count, design capacity, and full-charge capacity require a native desktop diagnostic tool.</p></section><footer class="foot">LAPCOREX Laptop Tester • This report was generated locally and no device data was uploaded.</footer></main></body></html>`;
  const blob = new Blob([reportHtml], { type: 'text/html' });
  const link = document.createElement('a');
  const stamp = generated.toISOString().slice(0, 10);
  link.href = URL.createObjectURL(blob); link.download = `Lapcorex_Diagnostic_Report_${stamp}.html`; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

const actions = { keyboard, mouse, display, speaker, microphone, webcam, system: systemInfo, battery, wifi, report };
document.querySelectorAll('.test-card').forEach((button) => button.onclick = () => {
  const test = button.dataset.test;
  if (test !== 'report' && testNames[test]) startedTests.add(test);
  actions[test]?.();
});
$('.close').onclick = closeModal;
modal.onclick = (event) => { if (event.target === modal) closeModal(); };
window.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); closeModal(); } });
window.addEventListener('online', loadDashboard);
window.addEventListener('offline', loadDashboard);
updateClock(); updateVisitors();
setInterval(updateClock, 1000);
setInterval(updateVisitors, 2800);
loadDashboard();
