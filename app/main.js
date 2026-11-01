const { app, BrowserWindow, Tray, Menu, shell, ipcMain, dialog, clipboard, nativeImage, Notification, net } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const QRCode = require('qrcode');

// Le cartelle dati stanno accanto all'app: "COLLEGA TELEFONO\dal-telefono" e "\dal-pc"
const BASE = app.isPackaged ? path.resolve(path.dirname(process.execPath), '..') : path.resolve(__dirname, '..');
const DIRS = { in: path.join(BASE, 'dal-telefono'), out: path.join(BASE, 'dal-pc') };
Object.values(DIRS).forEach(d => fs.mkdirSync(d, { recursive: true }));

const IMG = /\.(jpe?g|png|gif|webp|bmp|avif)$/i;
let port = 8080;
let win, tray, quitting = false;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => showWindow());

// ---------- util ----------
function lanIp() {
  const all = Object.values(os.networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal);
  return (all.find(i => i.address.startsWith('192.168.')) || all[0] || {}).address || 'localhost';
}
const baseUrl = () => `http://${lanIp()}:${port}`;

function safeName(n) { return path.basename(n || 'file').replace(/[<>:"/\\|?*]/g, '_') || 'file'; }
function uniqueName(dir, name) {
  const safe = safeName(name);
  const { name: base, ext } = path.parse(safe);
  let out = safe, i = 1;
  while (fs.existsSync(path.join(dir, out))) out = `${base} (${i++})${ext}`;
  return out;
}
function listDir(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isFile()).map(e => {
    const full = path.join(dir, e.name);
    const st = fs.statSync(full);
    return { name: e.name, size: st.size, mtime: st.mtimeMs, isImage: IMG.test(e.name), url: pathToFileURL(full).href };
  }).sort((a, b) => b.mtime - a.mtime);
}
function resolveIn(dirKey, name) {
  const full = path.join(DIRS[dirKey], safeName(name));
  return fs.existsSync(full) ? full : null;
}

// ---------- pagina del telefono ----------
const PHONE_PAGE = `<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Collega Telefono</title>
<style>
*{box-sizing:border-box}body{font-family:system-ui,sans-serif;margin:0;background:#111;color:#eee}
header{display:flex}header button{flex:1;padding:16px;font-size:16px;background:#1b1b1b;color:#aaa;border:0;border-bottom:3px solid transparent}
header button.on{color:#fff;border-color:#2e8bff}
section{display:none;padding:20px}section.on{display:block}
label.drop{display:block;margin:8px 0 16px;padding:36px 12px;border:2px dashed #888;border-radius:16px;font-size:18px;text-align:center}
input[type=file]{display:none}
.big{width:100%;padding:16px;font-size:18px;border:0;border-radius:12px;background:#2e8bff;color:#fff}
.row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #2a2a2a;font-size:15px}
.row img{width:56px;height:56px;object-fit:cover;border-radius:8px;background:#222}
.row .ic{width:56px;height:56px;border-radius:8px;background:#222;display:grid;place-items:center;font-size:24px}
.row a{color:#6db3ff;text-decoration:none;word-break:break-all;flex:1}
.muted{color:#888;text-align:center;padding:20px}
</style></head><body>
<header><button id="t1" class="on">Invia al PC</button><button id="t2">Dal PC</button></header>
<section id="s1" class="on">
  <label class="drop" for="f" id="lab">Tocca per scegliere foto o file</label>
  <input id="f" type="file" multiple><button class="big" id="go">Invia</button><div id="log"></div>
</section>
<section id="s2"><button class="big" id="rf">Aggiorna</button><div id="list"></div></section>
<script>
const $=id=>document.getElementById(id);
function tab(n){for(const i of [1,2]){$('t'+i).classList.toggle('on',i==n);$('s'+i).classList.toggle('on',i==n)}if(n==2)load()}
$('t1').onclick=()=>tab(1);$('t2').onclick=()=>tab(2);
$('f').onchange=()=>$('lab').textContent=$('f').files.length+' file selezionati';
$('go').onclick=async()=>{
  for(const file of $('f').files){
    const row=document.createElement('div');row.className='row';row.textContent='⏳ '+file.name;$('log').prepend(row);
    try{const r=await fetch('/upload',{method:'POST',headers:{'x-filename':encodeURIComponent(file.name)},body:file});row.textContent=(r.ok?'✅ ':'❌ ')+file.name}
    catch(e){row.textContent='❌ '+file.name}
  }
  $('f').value='';$('lab').textContent='Tocca per scegliere foto o file';
};
async function load(){
  const l=await (await fetch('/files')).json();
  $('list').innerHTML=l.length?'':'<div class="muted">Nessun file dal PC.<br>Trascinali nella finestra dell app.</div>';
  for(const f of l){
    const u='/dl/'+encodeURIComponent(f.name);
    const d=document.createElement('div');d.className='row';
    d.innerHTML=(f.isImage?'<img src="/view/'+encodeURIComponent(f.name)+'">':'<div class="ic">📄</div>')+'<a href="'+u+'" download></a>';
    d.querySelector('a').textContent=f.name;$('list').append(d);
  }
}
$('rf').onclick=load;
</script></body></html>`;

const LOGIN_PAGE = `<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Collega Telefono</title>
<style>*{box-sizing:border-box}
html,body{max-width:100%;overflow-x:hidden}
body{font-family:system-ui,sans-serif;margin:0;padding:32px 20px;background:#111;color:#eee;text-align:center}
input{display:block;width:100%;padding:14px 8px;font-size:22px;text-align:center;letter-spacing:3px;border-radius:12px;border:1px solid #444;background:#1b1b1b;color:#fff;margin:16px 0;text-transform:uppercase}
button{display:block;width:100%;padding:16px;font-size:18px;border:0;border-radius:12px;background:#2e8bff;color:#fff}
#e{color:#ff7b7b;min-height:24px}</style></head><body>
<h2>Collega Telefono</h2><p>Inserisci la password mostrata sul PC</p>
<input id="p" autocomplete="off" autocapitalize="characters" autofocus><div id="e"></div><button id="b">Entra</button>
<script>
async function go(){
  const r=await fetch('/login',{method:'POST',body:document.getElementById('p').value});
  if(r.ok) location.reload();
  else document.getElementById('e').textContent=r.status==429?'Troppi tentativi, riprova tra un minuto':'Password sbagliata';
}
document.getElementById('b').onclick=go;
document.getElementById('p').onkeydown=e=>{if(e.key==='Enter')go()};
</script></body></html>`;

// ---------- accesso da fuori casa (tunnel Cloudflare + password temporanea) ----------
const CF_URL = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';
// accanto all'exe; se la cartella non è scrivibile (niente admin) ripiega sui dati utente
function toolsDir() {
  const d = path.join(BASE, 'tools');
  try { fs.mkdirSync(d, { recursive: true }); fs.accessSync(d, fs.constants.W_OK); return d; }
  catch { return path.join(app.getPath('userData'), 'tools'); }
}
const CF = path.join(toolsDir(), 'cloudflared.exe');
const PW_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const tunnel = { status: 'off', url: '', password: '', error: '', proc: null };
const tokens = new Set();
const fails = new Map(); // ip -> { n, until }

function newPassword() {
  return Array.from({ length: 6 }, () => PW_ALPHABET[crypto.randomInt(PW_ALPHABET.length)]).join('');
}
function isExternal(req) {
  return !!req.headers['cf-connecting-ip'] || /trycloudflare\.com$/i.test((req.headers.host || '').split(':')[0]);
}
function tokenOf(req) {
  const m = /(?:^|;\s*)ct_token=([a-f0-9]+)/.exec(req.headers.cookie || '');
  return m && m[1];
}
function samePassword(a) {
  const x = Buffer.from(a.trim().toUpperCase()), y = Buffer.from(tunnel.password);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function handleLogin(req, res) {
  const ip = req.headers['cf-connecting-ip'] || 'x';
  const f = fails.get(ip) || { n: 0, until: 0 };
  if (Date.now() < f.until) { res.writeHead(429); return res.end(); }
  let body = '';
  req.on('data', c => { body += c; if (body.length > 100) req.destroy(); });
  req.on('end', () => {
    if (tunnel.status === 'on' && samePassword(body)) {
      fails.delete(ip);
      const t = crypto.randomBytes(24).toString('hex');
      tokens.add(t);
      res.writeHead(200, { 'Set-Cookie': `ct_token=${t}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=86400` });
      return res.end('ok');
    }
    f.n++;
    if (f.n >= 5) { f.n = 0; f.until = Date.now() + 60000; }
    fails.set(ip, f);
    res.writeHead(401); res.end();
  });
}

async function ensureCloudflared(onProgress = () => {}) {
  if (fs.existsSync(CF)) return;
  fs.mkdirSync(path.dirname(CF), { recursive: true });
  const r = await net.fetch(CF_URL);
  if (!r.ok) throw new Error('download fallito (' + r.status + ')');
  const total = Number(r.headers.get('content-length')) || 0;
  const out = fs.createWriteStream(CF + '.part');
  const reader = r.body.getReader();
  let got = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await new Promise((ok, ko) => out.write(value, e => e ? ko(e) : ok()));
      got += value.length;
      onProgress(got, total);
    }
    await new Promise(ok => out.end(ok));
    if (total && got !== total) throw new Error('file incompleto');
  } catch (e) {
    out.destroy(); fs.rmSync(CF + '.part', { force: true });
    throw e;
  }
  fs.renameSync(CF + '.part', CF);
}

// Schermata di caricamento: resta aperta finché non c'è tutto ciò che serve (riprova da sola se cade la rete)
async function ensureTools() {
  if (fs.existsSync(CF)) return true;
  const sp = new BrowserWindow({
    width: 460, height: 250, resizable: false, minimizable: false, maximizable: false, autoHideMenuBar: true,
    title: 'Collega Telefono', backgroundColor: '#14161a', icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false },
  });
  sp.setMenu(null);
  await sp.loadFile(path.join(__dirname, 'splash.html'));
  let state = 'working'; // working | skipped | closed | done
  sp.on('closed', () => { if (state !== 'done') state = 'closed'; });
  ipcMain.once('skip', () => { if (state === 'working') state = 'skipped'; });
  const ui = (pct, text, err) => { if (!sp.isDestroyed()) sp.webContents.executeJavaScript(`setP(${JSON.stringify([pct, text, !!err])})`).catch(() => {}); };
  const mb = b => (b / 1048576).toFixed(1);
  ui(-1, 'Preparazione componenti…');
  while (state === 'working' && !fs.existsSync(CF)) {
    try {
      await ensureCloudflared((got, total) => ui(total ? got / total * 100 : -1, total ? `Scarico i componenti… ${mb(got)} / ${mb(total)} MB` : `Scarico i componenti… ${mb(got)} MB`));
    } catch (e) {
      ui(-1, `Errore: ${e.message}. Riprovo tra poco…`, true);
      for (let i = 0; i < 10 && state === 'working'; i++) await new Promise(r => setTimeout(r, 500));
    }
  }
  if (state === 'closed') return false;
  state = 'done';
  if (!sp.isDestroyed()) sp.close();
  return true;
}
function stopTunnel() {
  if (tunnel.proc) { try { tunnel.proc.kill(); } catch {} }
  Object.assign(tunnel, { status: 'off', url: '', password: '', error: '', proc: null });
  tokens.clear(); fails.clear();
}
async function startTunnel() {
  if (tunnel.status !== 'off') return;
  Object.assign(tunnel, { status: 'starting', url: '', error: '', password: newPassword() });
  changed();
  try {
    await ensureCloudflared();
    if (tunnel.status !== 'starting') return; // spento nel frattempo
    const proc = spawn(CF, ['tunnel', '--url', `http://127.0.0.1:${port}`, '--no-autoupdate'], { windowsHide: true });
    tunnel.proc = proc;
    const fail = msg => { if (tunnel.proc === proc) { stopTunnel(); tunnel.status = 'error'; tunnel.error = msg; changed(); } };
    const timer = setTimeout(() => fail('nessuna risposta da internet (rete bloccata?)'), 40000);
    const onData = d => {
      const m = /https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/.exec(d.toString());
      if (m && tunnel.status === 'starting' && tunnel.proc === proc) {
        clearTimeout(timer); tunnel.url = m[0]; tunnel.status = 'on'; changed();
      }
    };
    proc.stderr.on('data', onData); proc.stdout.on('data', onData);
    proc.on('exit', () => { clearTimeout(timer); if (tunnel.proc === proc) fail('connessione chiusa'); });
    proc.on('error', e => { clearTimeout(timer); fail(e.message); });
  } catch (e) {
    stopTunnel(); tunnel.status = 'error'; tunnel.error = e.message; changed();
  }
}

// ---------- server ----------
function notify(body) {
  if (Notification.isSupported()) new Notification({ title: 'Collega Telefono', body }).show();
}
function startServer(p) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const route = url.pathname;
    try {
      if (isExternal(req)) {
        if (tunnel.status !== 'on') { res.writeHead(403); return res.end(); }
        if (req.method === 'POST' && route === '/login') return handleLogin(req, res);
        if (!tokens.has(tokenOf(req))) {
          if (req.method === 'GET' && route === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(LOGIN_PAGE); }
          res.writeHead(401); return res.end();
        }
      }
      if (req.method === 'GET' && route === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(PHONE_PAGE); }
      if (req.method === 'GET' && route === '/files') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(listDir(DIRS.out).map(({ name, size, isImage }) => ({ name, size, isImage }))));
      }
      if (req.method === 'GET' && (route.startsWith('/dl/') || route.startsWith('/view/'))) {
        const name = decodeURIComponent(route.split('/').slice(2).join('/'));
        const full = resolveIn('out', name);
        if (!full) { res.writeHead(404); return res.end(); }
        const attach = route.startsWith('/dl/');
        res.writeHead(200, {
          'Content-Length': fs.statSync(full).size,
          'Content-Disposition': `${attach ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(path.basename(full))}`,
          ...(attach ? { 'Content-Type': 'application/octet-stream' } : {}),
        });
        return fs.createReadStream(full).pipe(res);
      }
      if (req.method === 'POST' && route === '/upload') {
        const name = uniqueName(DIRS.in, decodeURIComponent(req.headers['x-filename'] || 'file'));
        const out = fs.createWriteStream(path.join(DIRS.in, name));
        req.pipe(out);
        out.on('finish', () => { res.writeHead(200); res.end('ok'); notify('Ricevuto: ' + name); changed(); });
        out.on('error', () => { res.writeHead(500); res.end(); });
        return;
      }
    } catch (e) { res.writeHead(500); return res.end(); }
    res.writeHead(404); res.end();
  });
  server.on('error', e => {
    if (e.code === 'EADDRINUSE' && p < 8090) startServer(p + 1);
    else dialog.showErrorBox('Collega Telefono', 'Impossibile avviare il server: ' + e.message);
  });
  server.listen(p, '0.0.0.0', () => { port = p; changed(); });
}

// ---------- finestra + tray ----------
let debounce;
function changed() {
  clearTimeout(debounce);
  debounce = setTimeout(() => { if (win && !win.isDestroyed()) win.webContents.send('changed'); }, 200);
}
function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
}
function createWindow(hidden) {
  win = new BrowserWindow({
    width: 980, height: 700, minWidth: 720, minHeight: 520, show: !hidden,
    title: 'Collega Telefono', backgroundColor: '#14161a', autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false },
  });
  win.setMenu(null);
  win.loadFile(path.join(__dirname, 'viewer.html'));
  win.on('close', e => { if (!quitting) { e.preventDefault(); win.hide(); } });
}
function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 16, height: 16 }));
  tray.setToolTip('Collega Telefono');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Apri', click: showWindow },
    { label: 'Cartella ricevuti dal telefono', click: () => shell.openPath(DIRS.in) },
    { label: 'Cartella da inviare al telefono', click: () => shell.openPath(DIRS.out) },
    { type: 'separator' },
    { label: 'Avvia con Windows', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: m => app.setLoginItemSettings({ openAtLogin: m.checked, args: ['--hidden'] }) },
    { type: 'separator' },
    { label: 'Esci', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', showWindow);
}

// ---------- IPC ----------
ipcMain.handle('info', async () => {
  const url = baseUrl();
  const remote = { status: tunnel.status, url: tunnel.url, password: tunnel.password, error: tunnel.error,
    qr: tunnel.url ? await QRCode.toDataURL(tunnel.url, { margin: 1, width: 240 }) : '' };
  return { url, qr: await QRCode.toDataURL(url, { margin: 1, width: 240 }), remote, inFiles: listDir(DIRS.in), outFiles: listDir(DIRS.out) };
});
ipcMain.handle('remote', (_, on) => { if (on) startTunnel(); else { stopTunnel(); changed(); } });
ipcMain.handle('open', (_, key, name) => { const f = resolveIn(key, name); return f ? shell.openPath(f) : null; });
ipcMain.handle('reveal', (_, key, name) => { const f = resolveIn(key, name); if (f) shell.showItemInFolder(f); });
ipcMain.handle('openDir', (_, key) => shell.openPath(DIRS[key]));
ipcMain.handle('trash', async (_, key, name) => { const f = resolveIn(key, name); if (f) await shell.trashItem(f); changed(); });
ipcMain.handle('copy', (_, text) => clipboard.writeText(text));
ipcMain.handle('addFiles', (_, paths) => {
  for (const p of paths) {
    try { if (fs.statSync(p).isFile()) fs.copyFileSync(p, path.join(DIRS.out, uniqueName(DIRS.out, path.basename(p)))); } catch {}
  }
  changed();
});
ipcMain.handle('pick', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'] });
  return r.canceled ? [] : r.filePaths;
});

app.whenReady().then(async () => {
  if (!(await ensureTools())) return app.quit(); // finestra di caricamento chiusa dall'utente
  createWindow(process.argv.includes('--hidden'));
  createTray();
  startServer(port);
  for (const d of Object.values(DIRS)) { try { fs.watch(d, changed); } catch {} }
});
app.on('before-quit', stopTunnel);
app.on('window-all-closed', () => {}); // resta nella tray
