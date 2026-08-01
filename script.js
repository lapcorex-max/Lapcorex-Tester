const $ = (selector) => document.querySelector(selector);
const modal = $('#test-modal');
const content = $('#modal-content');
let webcamStream, micStream, audioContext, animationId, keyboardHandler;
let visitorEstimate = Math.floor(Math.random() * 75001) + 25000;
function updateVisitors(){visitorEstimate=Math.max(25000,Math.min(100000,visitorEstimate+Math.floor(Math.random()*7)-3));const count=$('#visitor-count');if(count)count.textContent=visitorEstimate;}

function updateClock() { const now = new Date(); $('#current-time').textContent = now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}); $('#current-date').textContent = now.toLocaleDateString([], {day:'2-digit',month:'long',year:'numeric'}); $('#current-day').textContent = now.toLocaleDateString([], {weekday:'long'}); const uptime=$('#uptime');if(uptime){const seconds=Math.floor(performance.now()/1000),hours=String(Math.floor(seconds/3600)).padStart(2,'0'),minutes=String(Math.floor(seconds%3600/60)).padStart(2,'0'),secs=String(seconds%60).padStart(2,'0');uptime.textContent=`${hours}:${minutes}:${secs}`;} }
function browserName(){ const ua=navigator.userAgent; if(ua.includes('Edg/'))return 'Microsoft Edge'; if(ua.includes('Chrome/'))return 'Google Chrome'; if(ua.includes('Firefox/'))return 'Firefox'; return 'Web Browser'; }
async function loadDashboard(){ $('#screen-size').textContent=`${screen.width} × ${screen.height}`; $('#browser-name').textContent=browserName(); $('#cpu-threads').textContent=`${navigator.hardwareConcurrency || '—'} Threads`; $('#ram-size').textContent=`${navigator.deviceMemory || '—'} GB`; $('#network-state').textContent=navigator.onLine?'Online':'Offline'; const conn=navigator.connection; $('#network-type').textContent=conn?.effectiveType ? `${conn.effectiveType.toUpperCase()} connection` : 'Connected'; if(navigator.storage?.estimate){const e=await navigator.storage.estimate(); $('#storage-size').textContent=e.quota?`${Math.round(e.quota/1024**3)} GB`:'Available';} if(navigator.getBattery){const b=await navigator.getBattery(); const show=()=>{$('#battery-level').textContent=`${Math.round(b.level*100)}%`; $('#battery-state').textContent=b.charging?'Charging':'On battery';};show(); b.addEventListener('levelchange',show);b.addEventListener('chargingchange',show);}else{$('#battery-level').textContent='Not supported';} }
function closeModal(){ stopMedia(); if(keyboardHandler){window.removeEventListener('keydown',keyboardHandler);keyboardHandler=null;} modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); }
function openModal(html){ content.innerHTML=html; modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); }
function stopMedia(){ webcamStream?.getTracks().forEach(t=>t.stop()); micStream?.getTracks().forEach(t=>t.stop()); webcamStream=micStream=null; cancelAnimationFrame(animationId); if(audioContext){audioContext.close();audioContext=null;} }
const infoCard=(title,rows)=>`<section class="info-card"><h3>${title}</h3>${rows.map(([label,value])=>`<div><span>${label}</span><b>${value ?? 'Not available'}</b></div>`).join('')}</section>`;
const bytes=value=>value==null?'Not available':`${(value/1024**3).toFixed(2)} GB`;
async function systemInfo(){
  openModal(`<h2>Advanced System Information</h2><p>Live diagnostics collected locally by your browser. Some hardware values are restricted by browser privacy settings.</p><div class="advanced-grid" id="system-details"><p>Collecting system information…</p></div>`);
  let gpu='Not available',gpuVendor='Not available',storage={},ua={};
  try{const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl')||canvas.getContext('experimental-webgl');if(gl){const ext=gl.getExtension('WEBGL_debug_renderer_info');gpu=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);gpuVendor=ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR)}}catch{}
  try{storage=await navigator.storage?.estimate()||{}}catch{}
  try{ua=await navigator.userAgentData?.getHighEntropyValues(['architecture','bitness','model','platformVersion','fullVersionList'])||{}}catch{}
  const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  const orientation=screen.orientation?.type||'Not available';
  const language=[...new Set(navigator.languages||[navigator.language])].join(', ');
  const details=$('#system-details'); if(!details)return;
  details.innerHTML=[
    infoCard('Device & Browser',[['Operating system',ua.platform||navigator.platform],['Platform version',ua.platformVersion],['Architecture',ua.architecture?`${ua.architecture} ${ua.bitness||''}`:null],['Browser',browserName()],['User agent',navigator.userAgent],['Languages',language],['Cookies enabled',navigator.cookieEnabled?'Yes':'No'],['Do Not Track',navigator.doNotTrack||'Not set']]),
    infoCard('Processor & Graphics',[['Logical CPU cores',navigator.hardwareConcurrency||null],['Device memory',navigator.deviceMemory?`${navigator.deviceMemory} GB`:null],['GPU vendor',gpuVendor],['GPU renderer',gpu],['WebGL',gpu==='Not available'?'Unavailable':'Supported'],['JavaScript heap limit',performance.memory?bytes(performance.memory.jsHeapSizeLimit):null],['Heap in use',performance.memory?bytes(performance.memory.usedJSHeapSize):null]]),
    infoCard('Display & Input',[['Resolution',`${screen.width} × ${screen.height}`],['Available display',`${screen.availWidth} × ${screen.availHeight}`],['Color depth',`${screen.colorDepth}-bit`],['Pixel ratio',window.devicePixelRatio],['Orientation',orientation],['Touch points',navigator.maxTouchPoints||0],['Pointer support',matchMedia('(pointer:fine)').matches?'Mouse / touchpad':'Touch or unknown']]),
    infoCard('Network & Storage',[['Connection status',navigator.onLine?'Online':'Offline'],['Connection type',c?.effectiveType?.toUpperCase()||null],['Estimated downlink',c?.downlink?`${c.downlink} Mbps`:null],['Estimated latency',c?.rtt?`${c.rtt} ms`:null],['Storage quota',bytes(storage.quota)],['Storage used',bytes(storage.usage)],['Service worker',('serviceWorker'in navigator)?'Supported':'Not supported']]),
    infoCard('Regional Settings',[['Time zone',zone],['Local time',new Date().toLocaleString()],['Locale',navigator.language],['Online since page opened',`${Math.round(performance.now()/1000)} seconds`],['Secure context',window.isSecureContext?'Yes':'No'],['PDF viewer',navigator.pdfViewerEnabled?'Supported':'Not available']])
  ].join('');
}
function keyboard(){
const k=(label,code,wide='')=>`<span class="key ${wide}" data-code="${code}">${label}</span>`,row=items=>`<div class="key-row">${items.join('')}</div>`;
const layout=[
row([k('Esc','Escape'),...['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'].map(x=>k(x,x))]),
row([k('`','Backquote'),...['1','2','3','4','5','6','7','8','9','0'].map(x=>k(x,`Digit${x}`)),k('-','Minus'),k('=','Equal'),k('Backspace','Backspace','back')]),
row([k('Tab','Tab','tab'),...['Q','W','E','R','T','Y','U','I','O','P'].map(x=>k(x,`Key${x}`)),k('[','BracketLeft'),k(']','BracketRight'),k('\\','Backslash','wide')]),
row([k('Caps Lock','CapsLock','caps'),...['A','S','D','F','G','H','J','K','L'].map(x=>k(x,`Key${x}`)),k(';','Semicolon'),k("'",'Quote'),k('Enter','Enter','enter')]),
row([k('Shift','ShiftLeft','shift'),...['Z','X','C','V','B','N','M'].map(x=>k(x,`Key${x}`)),k(',','Comma'),k('.','Period'),k('/','Slash'),k('Shift','ShiftRight','shift')]),
row([k('Ctrl','ControlLeft','ctrl'),k('Win','MetaLeft','win'),k('Alt','AltLeft','alt'),k('Space','Space','space'),k('Alt','AltRight','alt'),k('Ctrl','ControlRight','ctrl'),k('←','ArrowLeft','arrow'),k('↑','ArrowUp','arrow'),k('↓','ArrowDown','arrow'),k('→','ArrowRight','arrow')])].join('');
openModal(`<h2>Full Keyboard Test</h2><p>Press every key. Detected keys will glow purple.</p><div class="keyboard-layout">${layout}</div><p id="key-result">0 / ${layout.match(/data-code=/g).length} keys detected</p>`);
document.activeElement?.blur();
const seen=new Set();
const markKey=code=>{const target=content.querySelector(`[data-code="${code}"]`);if(!target)return false;target.classList.add('active');seen.add(code);$('#key-result').textContent=`${seen.size} / ${content.querySelectorAll('[data-code]').length} keys detected`;return true;};
keyboardHandler=e=>{if(markKey(e.code))e.preventDefault();};
content.querySelectorAll('.key[data-code]').forEach(key=>key.addEventListener('click',()=>markKey(key.dataset.code)));
window.addEventListener('keydown',keyboardHandler);
}
function mouse(){openModal(`<h2>Mouse / Touchpad Test</h2><p>Move, click, double-click and scroll inside the zone.</p><div class="test-zone" id="mouse-zone"><h3 id="mouse-status">Move your pointer here</h3><p id="mouse-pos">X: 0 · Y: 0</p></div>`);const z=$('#mouse-zone');z.onmousemove=e=>{const r=z.getBoundingClientRect();$('#mouse-pos').textContent=`X: ${Math.round(e.clientX-r.left)} · Y: ${Math.round(e.clientY-r.top)}`;$('#mouse-status').textContent='Movement detected ✓'};z.onmousedown=e=>$('#mouse-status').textContent=['Left click ✓','Middle click ✓','Right click ✓'][e.button]||'Click detected';z.onwheel=e=>{$('#mouse-status').textContent=e.deltaY>0?'Scroll down ✓':'Scroll up ✓';e.preventDefault()};z.oncontextmenu=e=>e.preventDefault();}
function display(){

openModal(`
<h2>LCD / Display Diagnostic</h2>

<p>Select any display test.</p>

<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:15px;margin-top:25px;">

<button class="action-btn" id="colorTestBtn">
🎨 Color Test
</button>

<button class="action-btn" id="pixelTestBtn">
🟥 Dead Pixel Test
</button>

<button class="action-btn" id="dotTestBtn">
⚪ Pixel Dot Test
</button>

<button class="action-btn" id="touchTestBtn">
👆 Touch Screen Test
</button>

</div>

`);
  document.getElementById("colorTestBtn").onclick=()=>{
startColorTest();
};

document.getElementById("pixelTestBtn").onclick=()=>{
startDeadPixelTest();
};

document.getElementById("dotTestBtn").onclick=()=>{
startDotTest();
};

document.getElementById("touchTestBtn").onclick=()=>{
startTouchTest();
};
}
function speaker(){openModal(`<h2>Speaker Test</h2><p>Play a short, comfortable tone through each channel.</p><button class="action-btn" data-tone="-1">◀ Left</button><button class="action-btn" data-tone="0">◉ Both</button><button class="action-btn" data-tone="1">Right ▶</button><p id="speaker-status">Choose a channel, then listen for the tone.</p>`);content.querySelectorAll('[data-tone]').forEach(b=>b.onclick=()=>{const A=window.AudioContext||window.webkitAudioContext;if(!A)return; audioContext=new A();const o=audioContext.createOscillator(),g=audioContext.createGain(),p=audioContext.createStereoPanner();o.frequency.value=440;g.gain.value=.1;p.pan.value=Number(b.dataset.tone);o.connect(g).connect(p).connect(audioContext.destination);o.start();$('#speaker-status').textContent='Tone playing…';setTimeout(()=>{o.stop();audioContext.close();audioContext=null;$('#speaker-status').textContent='Tone complete.'},1200)})}
async function webcam(){openModal(`<h2>Webcam Test</h2><p>Allow camera access to see the live preview.</p><button class="action-btn" id="start-camera">Start camera</button><p id="camera-status">Camera is not started.</p><video id="camera" autoplay muted playsinline style="width:100%;border-radius:13px;display:none;background:#000"></video>`);$('#start-camera').onclick=async()=>{try{webcamStream=await navigator.mediaDevices.getUserMedia({video:true});$('#camera').srcObject=webcamStream;$('#camera').style.display='block';$('#camera-status').textContent='Camera is working ✓'}catch{$('#camera-status').textContent='Camera permission was not granted.'}}}
async function microphone(){openModal(`<h2>Microphone Test</h2><p>Allow access and speak into your microphone.</p><button class="action-btn" id="start-mic">Start microphone</button><div class="meter"><i id="mic-meter"></i></div><p id="mic-status">Microphone is not started.</p>`);$('#start-mic').onclick=async()=>{try{micStream=await navigator.mediaDevices.getUserMedia({audio:true});const A=window.AudioContext||window.webkitAudioContext;audioContext=new A();const a=audioContext.createAnalyser();audioContext.createMediaStreamSource(micStream).connect(a);const data=new Uint8Array(a.fftSize);const tick=()=>{a.getByteTimeDomainData(data);let total=0;data.forEach(v=>total+=(v-128)**2);$('#mic-meter').style.width=Math.min(100,Math.sqrt(total/data.length)*2)+'%';animationId=requestAnimationFrame(tick)};tick();$('#mic-status').textContent='Microphone connected ✓'}catch{$('#mic-status').textContent='Microphone permission was not granted.'}}}
async function battery(){
  openModal(`<h2>Advanced Battery Information</h2><p>Live battery readings from your browser.</p><div id="battery-detail" class="advanced-grid"><p>Reading battery status…</p></div>`);
  if(!navigator.getBattery){$('#battery-detail').innerHTML='<div class="test-zone">Battery information is not exposed by this browser. Try Chrome or Edge on a laptop.</div>';return;}
  const b=await navigator.getBattery();
  const render=()=>{const target=$('#battery-detail');if(!target)return;const percent=Math.round(b.level*100),time=s=>isFinite(s)?`${Math.floor(s/3600)}h ${Math.round(s%3600/60)}m`:'Not available';const health=percent>75?'Good':percent>30?'Moderate':'Low';target.innerHTML=`<section class="battery-hero"><strong>${percent}%</strong><div><b>${b.charging?'Charging':'Running on battery'}</b><small>${health} current charge level</small></div></section>${infoCard('Battery status',[['Current charge',`${percent}%`],['Power source',b.charging?'AC adapter connected':'Battery power'],['Charging time remaining',b.charging?time(b.chargingTime):'Not charging'],['Estimated time remaining',!b.charging?time(b.dischargingTime):'Charging'],['Charge level assessment',health],['Live updates','Enabled']])}<p class="privacy-note">Note: battery model, cycle count, temperature and true health/capacity are not available to normal websites. Use a manufacturer utility for those values.</p>`};
  render();['chargingchange','levelchange','chargingtimechange','dischargingtimechange'].forEach(event=>b.addEventListener(event,render));
}
function wifi(){openModal(`<h2>WiFi / Network Test</h2><p>Checking your browser’s current network connection.</p><div class="test-zone"><b>Status:</b> ${navigator.onLine?'Online ✓':'Offline'}<br><b>Type:</b> ${navigator.connection?.effectiveType||'Unknown'}<br><b>Estimated speed:</b> ${navigator.connection?.downlink?`${navigator.connection.downlink} Mbps`:'Not available'}<br><b>Latency:</b> ${navigator.connection?.rtt?`${navigator.connection.rtt} ms`:'Not available'}</div>`)}
function report(){const report=`LAPCOREX LAPTOP TEST REPORT\nGenerated: ${new Date().toLocaleString()}\n\nPlatform: ${navigator.platform}\nBrowser: ${browserName()}\nCPU Threads: ${navigator.hardwareConcurrency||'Unknown'}\nMemory: ${navigator.deviceMemory||'Unknown'} GB\nScreen: ${screen.width} x ${screen.height}\nNetwork: ${navigator.onLine?'Online':'Offline'}`;const blob=new Blob([report],{type:'text/plain'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Lapcorex_Test_Report.txt';a.click();URL.revokeObjectURL(a.href);}
const actions={keyboard,mouse,display,speaker,microphone,webcam,system:systemInfo,battery,wifi,report};document.querySelectorAll('.test-card').forEach(b=>b.onclick=()=>actions[b.dataset.test]());$('.close').onclick=closeModal;modal.onclick=e=>{if(e.target===modal)closeModal()};window.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeModal()}});window.addEventListener('online',loadDashboard);window.addEventListener('offline',loadDashboard);updateClock();updateVisitors();setInterval(updateClock,1000);setInterval(updateVisitors,2800);loadDashboard();
function startColorTest(){
if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
}
const colors=[
"#000",
"#fff",
"#ff0000",
"#00ff00",
"#0000ff",
"#ffff00",
"#8000ff"
];

let i=0;

const box=document.getElementById("color-test");

const text=document.getElementById("color-name");

box.classList.add("open");

function show(){

box.style.background=colors[i];

text.innerHTML=
"Click anywhere to change color";

}

show();

box.onclick=()=>{

i=(i+1)%colors.length;

show();

};

}
  function startDeadPixelTest(){
if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
}
const win=window.open("","_blank");
setTimeout(() => {
    if (win.document.documentElement.requestFullscreen) {
        win.document.documentElement.requestFullscreen().catch(() => {});
    }
}, 300);
win.document.write(`
#backBtn{
    position:fixed;
    top:20px;
    left:20px;
    z-index:9999;
    padding:12px 22px;
    border:none;
    border-radius:10px;
    background:#962eff;
    color:#fff;
    font-size:18px;
    font-weight:bold;
    cursor:pointer;
    box-shadow:0 0 20px #962eff;
    transition:.3s;
}

#backBtn:hover{
    transform:scale(1.08);
}
<body style="
margin:0;
background:black;
overflow:hidden;
cursor:none;
">

<canvas id="c"></canvas>

<script>

let canvas=document.getElementById("c");

canvas.width=innerWidth;

canvas.height=innerHeight;

let ctx=canvas.getContext("2d");

for(let x=0;x<innerWidth;x+=4){

for(let y=0;y<innerHeight;y+=4){

ctx.fillStyle=Math.random()>0.5?"white":"black";

ctx.fillRect(x,y,2,2);

}

}

<\/script>

</body>

`);

}
 function startDotTest(){
if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
}
const win=window.open("","_blank");
setTimeout(() => {
    if (win.document.documentElement.requestFullscreen) {
        win.document.documentElement.requestFullscreen().catch(() => {});
    }
}, 300);
win.document.write(`

<body style="margin:0;background:black;">

<div style="
width:3px;
height:3px;
background:white;
border-radius:50%;
position:absolute;
top:50%;
left:50%;
transform:translate(-50%,-50%);
box-shadow:0 0 12px white;
"></div>

</body>

`);

}
  function startTouchTest(){
if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
}
const win=window.open("","_blank");
setTimeout(() => {
    if (win.document.documentElement.requestFullscreen) {
        win.document.documentElement.requestFullscreen().catch(() => {});
    }
}, 300);
win.document.write(`

<body style="
margin:0;
background:black;
overflow:hidden;
touch-action:none;
">

<script>

document.body.ontouchmove=function(e){

for(let t of e.touches){

let d=document.createElement("div");

d.style.position="absolute";

d.style.left=t.clientX+"px";

d.style.top=t.clientY+"px";

d.style.width="40px";

d.style.height="40px";

d.style.borderRadius="50%";

d.style.background="#9b3cff";

d.style.boxShadow="0 0 25px #9b3cff";

document.body.appendChild(d);

setTimeout(()=>d.remove(),600);

}

}

<\/script>

</body>

`);

}
