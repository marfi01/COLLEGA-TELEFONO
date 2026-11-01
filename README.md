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

## Come si usa

### Con l'exe (consigliato)

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
