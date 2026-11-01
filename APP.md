# APP.md — istruzioni tecniche per l'AI

Questo file serve a chi (AI o persona) deve modificare il progetto senza rileggere tutta la conversazione che l'ha generato. Per l'uso normale vedi [README.md](README.md).

## Cos'è

App Windows nella tray (Electron) che scambia file tra telefono e PC. Il PC ospita un piccolo server HTTP; il telefono apre la pagina dal browser (nessuna app sul telefono). Opzionale: tunnel Cloudflare con password temporanea per l'uso fuori casa.

## Vincoli decisi dall'utente (non violarli)

- **Mai permessi admin.** L'exe deve girare con `asInvoker` (default di Electron, verificato nell'exe). Niente scritture in cartelle protette, niente regole firewall create dall'app. Se `tools/` accanto all'exe non è scrivibile, `toolsDir()` ripiega su `app.getPath('userData')`.
- **L'utente non usa il terminale.** Tutto ciò che serve all'uso deve essere nell'exe: doppio clic e basta. I comandi qui sotto li esegui tu.
- **Lingua dell'interfaccia e dei testi: italiano.**
- **Download dei componenti con schermata di caricamento e barra di avanzamento**, finché non c'è tutto ciò che serve (`ensureTools`).
- **Accesso da fuori casa:** spenta di default; con la spunta attiva, QR grande e indirizzo della finestra diventano quelli di internet e compare la password. Niente QR affiancato.

## Struttura

```
COLLEGA TELEFONO/
├── app/                      sorgenti (si lavora qui)
│   ├── main.js               processo principale: tray, server, tunnel, IPC
│   ├── preload.js            ponte sicuro verso le pagine (window.api)
│   ├── viewer.html           finestra principale sul PC
│   ├── splash.html           finestra di caricamento con progress bar
│   ├── make-icon.js          genera icon.png / icon.ico senza dipendenze
│   └── package.json          dipendenze: qrcode (runtime), electron + @electron/packager (dev)
├── Collega Telefono-win32-x64/   exe compilato (output del packager, ignorato da git)
├── dal-telefono/             file ricevuti dal telefono (dati utente, ignorata da git)
├── dal-pc/                   file da mandare al telefono (dati utente, ignorata da git)
└── tools/cloudflared.exe     scaricato al primo avvio (ignorata da git)
```

`BASE` in `main.js` = cartella che contiene l'exe (`..` dall'exe quando è compilato, `..` da `app/` in sviluppo). Le cartelle dati e `tools/` stanno in `BASE`, quindi **l'exe va tenuto dentro COLLEGA TELEFONO**.

## Come funziona (flusso)

1. `app.whenReady` → `ensureTools()`: se manca `cloudflared.exe` apre `splash.html` e scarica con progress (riprova ogni ~5 s; "Continua senza" lo salta; chiudere la splash chiude l'app).
2. Crea finestra (`viewer.html`), tray, server HTTP (porta 8080, se occupata prova fino a 8090 e il QR riporta la porta reale).
3. Il server serve la pagina del telefono (stringa `PHONE_PAGE` in `main.js`) con due schede: **Invia al PC** (POST `/upload`, body = file grezzo, nome in header `x-filename`, niente multipart) e **Dal PC** (GET `/files`, `/dl/<nome>`, `/view/<nome>`).
4. Le pagine HTML della finestra parlano con `main.js` solo via `window.api` (`preload.js`) → `ipcMain.handle(...)`. `contextIsolation: true`.
5. Aggiornamenti: `fs.watch` sulle due cartelle + `changed()` (debounce 200 ms) → evento `changed` alla finestra → `refresh()`.

## Accesso da fuori casa (tunnel)

- `startTunnel()` avvia `cloudflared tunnel --url http://127.0.0.1:<porta> --no-autoupdate` e legge l'indirizzo `https://*.trycloudflare.com` da stderr (esclude `api.`). Timeout 40 s → stato `error`.
- Stati in `tunnel.status`: `off | starting | on | error`. Si spegne con `stopTunnel()` (anche in `before-quit`).
- Password: 6 caratteri da alfabeto senza ambigui (`PW_ALPHABET`), nuova a ogni attivazione, confronto in tempo costante.
- Una richiesta è "esterna" se ha `cf-connecting-ip` o l'host finisce in `trycloudflare.com` (`isExternal`). Le esterne richiedono il cookie `ct_token` (HttpOnly, SameSite=Strict, Secure) ottenuto con POST `/login`; senza token solo `LOGIN_PAGE`, il resto 401. Dopo 5 errori per IP: blocco 60 s (429). Le richieste dalla LAN **non** chiedono password.
- Se cambi le route del server, controlla che passino dal blocco `isExternal` in `startServer`.

## Ripartire da un clone (l'exe non c'è)

Dopo un clone da GitHub ci sono solo i sorgenti. Non sono nel repo, e vanno ricreati: la cartella dell'exe, `app/node_modules/`, `tools/` e le cartelle dati.

1. **Verifica che ci sia Node.js** (`node -v`). Se manca, va installato da nodejs.org (versione LTS); non serve altro.
2. **Installa le dipendenze:** `npm install` dentro `app/` (scarica Electron, il packager e `qrcode`; serve internet).
3. **Compila l'exe** con il comando qui sotto. L'exe viene creato in `Collega Telefono-win32-x64/`, accanto ad `app/` (per via di `--out ..`).
4. **Non servono altri passi:** `dal-telefono/`, `dal-pc/` e `tools/` si creano da soli al primo avvio dell'exe (`cloudflared` viene scaricato con la barra di caricamento).

Cosa NON fa nessun editor (VS Code compreso): non conosce questi passi, vanno eseguiti i comandi.

## Comandi (esegui tu)

Dalla cartella `app/`:

```
npm install
node make-icon.js        # solo se cambi l'icona
npx @electron/packager . "Collega Telefono" --platform=win32 --arch=x64 --out .. --overwrite --icon=icon.ico --prune=true
```

Controllo sintassi rapido: `node --check main.js`.

## Trappole note

- **`ELECTRON_RUN_AS_NODE=1`** è impostata nell'ambiente di VS Code/Claude Code: con quella variabile l'exe parte come Node e **esce subito senza errori**. Prima di avviare l'exe per testare, rimuovila (`Remove-Item Env:ELECTRON_RUN_AS_NODE` in PowerShell). Sul PC dell'utente non c'è.
- **Ricompilare con l'exe aperto fallisce** (`EBUSY` su `rmdir`). Chiudi prima `Collega Telefono.exe` e `cloudflared.exe` (`Stop-Process`), e di' all'utente che l'hai chiuso.
- Gli heredoc lunghi in Bash possono rompersi con apici e backtick: per file grandi usa lo strumento di scrittura file.
- `File.path` non esiste più nelle versioni recenti di Electron: nel drag&drop si usa `webUtils.getPathForFile` esposto in `preload.js` come `api.pathFor`.
- Nelle pagine servite al telefono usa sempre `box-sizing:border-box` e il meta viewport: un input `width:100%` con padding senza border-box sfora lo schermo (già successo nella pagina di login).
- L'indirizzo trycloudflare nuovo può non essere risolvibile per alcuni secondi: Safari risponde "non trova il server". Idea non ancora fatta: far attendere all'app che l'URL risponda prima di mostrarlo.
- Il firewall di Windows chiede il permesso alla prima apertura (server su `0.0.0.0`): non dipende dall'app e senza admin può non essere confermabile.

## Come testare senza guardare lo schermo

- **Server:** avvia l'exe (senza `ELECTRON_RUN_AS_NODE`) e chiama `http://localhost:8080/files`, `/upload`, `/dl/...` con `Invoke-WebRequest`/`curl`.
- **UI e tunnel:** avvia l'exe con `--remote-debugging-port=9333`, collegati via WebSocket al target `page` dall'endpoint `/json` (Node ha `WebSocket` globale) ed esegui `Runtime.evaluate` (es. `api.remote(true)`, poi `api.info()`) o `Page.captureScreenshot`. Per provare la splash sposta temporaneamente `tools/` e riavvia l'exe.
- **Pagine del telefono:** per uno screenshot rapido estrai l'HTML e usa Edge headless (`--screenshot`); sotto i 500 px di finestra Edge headless taglia il rendering, quindi non fidarti di larghezze inferiori.
- Dopo i test elimina file di prova e ripristina `dal-telefono/` e `dal-pc/`: contengono dati personali dell'utente.

## Convenzioni

- Codice e commenti come il resto del progetto: JS semplice senza framework, commenti brevi in italiano, nessuna dipendenza in più se non serve.
- Non caricare su git `dal-telefono/`, `dal-pc/`, `tools/`, `node_modules/` e la cartella dell'exe (vedi `.gitignore`).
- Dopo ogni modifica a `app/`: ricompila l'exe e aggiorna `README.md` se cambia qualcosa di visibile all'utente.
