# Collega Telefono

Sposta foto e file tra telefono e PC Windows in un attimo, senza cavi e senza installare niente sul telefono.

Inquadri un QR code col telefono, si apre una pagina nel browser e da lì mandi file al PC o scarichi quelli che hai preparato sul PC. Funziona anche da fuori casa, con una password temporanea.

## Cosa fa

- **Telefono → PC:** scegli foto o file dal telefono, arrivano in una cartella del PC con una notifica.
- **PC → telefono:** trascini i file nella finestra dell'app e li scarichi dal telefono dalla scheda "Dal PC".
- **Visualizzatore integrato:** le foto ricevute hanno l'anteprima e si aprono a schermo intero, con le frecce per scorrerle.
- **Resta nella tray:** chiudendo la finestra l'app continua a girare vicino all'orologio. Dal menu della tray puoi aprire le cartelle o attivare l'avvio con Windows.
- **Accesso da fuori casa (opzionale):** una spunta apre un tunnel Cloudflare e mostra un nuovo QR con una password di 6 caratteri, valida solo finché il tunnel è acceso.
- Nessun account, nessun cloud intermedio: i file passano direttamente tra telefono e PC.

## Scaricare e installare l'app (su un altro computer)

Per **usare** l'app non serve clonare il repository, né GitHub Desktop, né Node.js. Basta scaricare la *Release*, cioè il programma già pronto:

1. Apri la pagina del repository su GitHub (https://github.com/marfi01/COLLEGA-TELEFONO).
2. Nella colonna destra clicca **Releases** e poi sull'ultima versione (la più in alto, per esempio `v1.0.0`).
3. In fondo alla pagina, sotto **Assets**, scarica `Collega-Telefono-v1.0.0.zip` (circa 150 MB).
4. Estrai lo zip dove vuoi, per esempio sul Desktop: tasto destro → **Estrai tutto**. Ottieni una cartella `COLLEGA TELEFONO`.
5. Apri la cartella `Collega Telefono-win32-x64` e fai doppio clic su `Collega Telefono.exe`. Se vuoi un'icona comoda: tasto destro sull'exe → **Invia a** → **Desktop (crea collegamento)**.

Al primo avvio l'app scarica da sola un componente (circa 50 MB) e mostra una barra di caricamento: serve internet solo quella volta. Non servono permessi di amministratore.

Note:
- Tieni **tutta** la cartella `COLLEGA TELEFONO`: l'exe da solo non parte, e i file scambiati vengono salvati lì accanto (`dal-telefono/` e `dal-pc/`).
- Windows può avvisarti con SmartScreen perché l'exe non è firmato: **Maggiori informazioni → Esegui comunque**. Alla prima apertura può chiedere anche il permesso del firewall: consenti solo le reti private.
- Per aggiornare l'app scarica la nuova Release e sostituisci la cartella `Collega Telefono-win32-x64`, lasciando `dal-telefono/` e `dal-pc/`.

Il clone del repository serve solo se vuoi **modificare** il codice o ricompilare l'exe: vedi "Compilare l'exe" più sotto.

## Come si usa

### Con l'exe

1. Avvia `Collega Telefono.exe`.
2. Inquadra il QR col telefono (PC e telefono sullo stesso Wi-Fi) oppure scrivi l'indirizzo mostrato, tipo `http://192.168.1.20:8080`.
3. Invia o scarica file.

I file ricevuti finiscono in `dal-telefono/`, quelli da mandare al telefono vanno in `dal-pc/`. Le due cartelle stanno accanto all'exe.

### Accesso da fuori casa

1. Nella finestra dell'app spunta **Accesso da fuori casa**.
2. Il QR grande e l'indirizzo diventano quelli di internet e compare la password.
3. Scansiona il QR (anche in 4G), scrivi la password sul telefono ed entri.
4. Togli la spunta, o chiudi l'app, quando hai finito: indirizzo e password smettono di valere. A ogni nuova attivazione sono diversi.

Al primo avvio l'app scarica `cloudflared` (circa 55 MB) nella cartella `tools/`, mostrando una schermata di caricamento con la barra di avanzamento. Se cade la rete riprova da sola; chi non vuole l'accesso da fuori casa può scegliere "Continua senza".

### Permessi

L'app non richiede mai i permessi di amministratore. Se `tools/` non è scrivibile, usa la cartella dati dell'utente.

## Compilare l'exe

Serve Node.js. Dalla cartella `app/`:

```
npm install
npx @electron/packager . "Collega Telefono" --platform=win32 --arch=x64 --out .. --overwrite --icon=icon.ico --prune=true
```

L'exe viene creato in `Collega Telefono-win32-x64/`, accanto ad `app/`. L'icona si rigenera con `node make-icon.js`.

## Struttura

```
COLLEGA TELEFONO/
├── app/                 sorgenti dell'app Electron (main.js, preload.js, viewer.html, splash.html)
├── dal-telefono/        file ricevuti dal telefono
├── dal-pc/              file da inviare al telefono
└── tools/               cloudflared (scaricato al primo avvio)
```

## Da sapere

- **Firewall:** la prima volta Windows chiede di consentire l'accesso alla rete. Scegli solo le reti private. Se rifiuti, il telefono non riuscirà ad aprire la pagina.
- **Sulla rete di casa non c'è password:** chiunque sia sullo stesso Wi-Fi e conosca l'indirizzo può mandare e scaricare file. Usalo su reti di cui ti fidi.
- **Da fuori casa** l'accesso è protetto dalla password temporanea, con blocco di un minuto dopo 5 tentativi sbagliati. L'indirizzo `trycloudflare.com` può richiedere qualche secondo prima di essere raggiungibile.
- **SmartScreen:** l'exe non è firmato, quindi Windows può avvisarti la prima volta ("Maggiori informazioni" → "Esegui comunque").
- **Reti aziendali:** possono bloccare sia la connessione tra dispositivi sia il tunnel. Su un PC di lavoro controlla le policy prima di usarlo.
- Solo Windows.

## Tecnologie

Electron, Node.js, [qrcode](https://www.npmjs.com/package/qrcode), [Cloudflare Tunnel (cloudflared)](https://github.com/cloudflare/cloudflared).
