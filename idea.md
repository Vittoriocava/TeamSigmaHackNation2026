# Play The City — Idea & Stack

## Concept centrale

**"Vivi la città da player, non da turista."**

Un gioco digitale board-style (stile Gioco dell'Oca / Monopoli) dove ogni città diventa una mappa da esplorare con tappe, sfide, quiz e storie generate dinamicamente dall'AI — personalizzate sul profilo del giocatore.

Due modalità di gioco:
- **Modalità Divano** — giochi da casa, esplori la città virtualmente prima di visitarla (o semplicemente per curiosità/cultura)
- **Modalità Campo** — sei fisicamente in città, il GPS sblocca le tappe reali mentre ti muovi

L'AI non è un chatbot. È il **narratore invisibile** che conosce il giocatore e costruisce la sua avventura unica: non monumenti da spuntare, ma connessioni nascoste da scoprire — tra storia, commercio, storie di vita, curiosità.

---

## Stack tecnico

### Frontend (Web + Mobile — unica codebase)
- **Next.js 15** (App Router) + **React** → PWA installabile su mobile, funziona su PC e smartphone
- **TailwindCSS** + **Framer Motion** → UI game-feel, animazioni fluide
- **Leaflet.js** → mappa interattiva open-source (no costi)
- **Geolocation API** del browser → per Modalità Campo
- **AR.js** + **A-Frame** → realtà aumentata web-based, zero app da installare, funziona via browser
- **WebXR API** → standard browser per esperienze AR/VR su mobile moderno
- **MindAR.js** → image tracking per riconoscimento visivo di luoghi/targhe/monumenti

### Backend / API
- **FastAPI** (Python) → veloce da costruire, perfetto per integrazioni AI
- **Supabase** → PostgreSQL + auth + realtime (setup in minuti, free tier abbondante)

### AI Layer
- **Claude API (Anthropic)** → generazione quiz, micro-storie, adattamento al profilo, narrativa
- **Wikipedia REST API** + **Wikidata** → fonte dati affidabile e gratuita per i luoghi
- **Overpass API (OpenStreetMap)** → POI della città (monumenti, botteghe, piazze)

### Infrastruttura
- **Vercel** → deploy Next.js istantaneo
- **Railway** o **Render** → deploy FastAPI

---

## Architettura del sistema

```
[Utente sceglie città + compila profilo]
            ↓
    [City Generator]
    OSM + Wikipedia → lista POI bilanciata
    (storia, arte, food, natura, nightlife, botteghe)
            ↓
    [Personalization Engine]
    Filtra e ordina i POI per il profilo specifico
    (età, interessi, lingua, livello culturale)
            ↓
    [Game Board Generator]
    Trasforma i POI in tappe del gioco (board Gioco dell'Oca)
    con caselle speciali: sfida, storia, quiz, bonus locale
            ↓
    [Claude AI Engine]  ← cuore del sistema
    Per ogni tappa genera:
    - Quiz (3 livelli difficoltà)
    - Micro-storia contestuale (200-300 parole)
    - Curiosità nascosta ("lo sapevi che...")
    - Connessione narrativa con la tappa precedente
            ↓
    [Game Loop]
    Il giocatore avanza, risponde, scopre, accumula punti
    In Modalità Campo: GPS verifica presenza fisica → bonus
            ↓
    [AR Layer]  ← si attiva in Modalità Campo
    Fotocamera inquadra il luogo → overlay AR con info,
    quiz flottanti, personaggi storici, strato temporale
    Claude Vision analizza la foto → risposta contestuale
```

---

## Meccaniche di gioco

### Board
- 10-15 tappe per partita (non troppe, non banali)
- Caselle tipo:
  - **Tappa Storia** → micro-storia narrata dall'AI
  - **Quiz** → domanda a scelta multipla, difficoltà adattiva
  - **Sfida Locale** → "trova una bottega storica in questo quartiere"
  - **Curiosità Nascosta** → fatto sorprendente, la città sotto la superficie
  - **Connessione** → link tra due luoghi lontani nel tempo ma vicini nel senso
  - **Sfida AR** → in Modalità Campo, inquadra il luogo con la fotocamera per sbloccare la tappa

### Profilo giocatore (onboarding rapido)
- Età (fascia)
- Interessi (arte / storia / food / natura / nightlife / architettura)
- Lingua (italiano, inglese, francese, spagnolo — Claude multilingue nativo)
- Livello culturale (casual / appassionato / esperto)

### Progressione
- Punti "Spirito del Luogo" accumulati per ogni tappa
- Badge tematici (es. "Storico", "Foodie", "Esploratore")
- Al termine: **Carta d'Identità della Città** — un riassunto narrativo personalizzato dell'avventura vissuta

---

## Feature differenzianti (wow factor per la giuria)

### 1. "Lo Spirito del Luogo"
Ogni città ha un filo narrativo invisibile che l'AI costruisce all'inizio e svela progressivamente tappa per tappa. Non una guida: una storia che emerge.

### 2. Layer Botteghe / Commercio Locale
Tra le tappe possono apparire botteghe storiche, mercati, artigiani — non come pubblicità, ma come parte del DNA urbano. Connette cultura e territorio reale.

### 3. Modalità Temporale
Lo stesso luogo in epoche diverse: l'AI racconta lo stesso posto nel Medioevo, nel '900 e oggi. Il giocatore "viaggia nel tempo" restando fermo.

### 4. Multiplayer asincrono
Più giocatori, stessa città, board diversa. Alla fine si confrontano le "versioni" della città che hanno scoperto — ognuno ha vissuto un pezzo diverso.

### 5. Verified Source Layer
Ogni contenuto mostra la fonte (Wikipedia, Wikidata, OSM) con link. Affidabilità visibile, non dichiarata.

### 6. AR "Occhio del Tempo" (flagship feature)
In Modalità Campo, punti la fotocamera verso un edificio o una piazza. L'AR sovrappone:
- **Layer storico**: come appariva quel luogo 100/500 anni fa (immagini d'epoca + narrazione AI)
- **Personaggi contestuali**: figure storiche legate al luogo appaiono come overlay animati
- **Quiz flottanti**: domande che emergono dal luogo reale inquadrato
- **Dettagli nascosti**: frecce AR che indicano elementi architettonici da cercare (una data, uno stemma, un simbolo)

Tecnicamente: AR.js per location-based + Claude Vision API per analizzare la foto scattata e generare contenuto contestuale in tempo reale.

### 7. "Scatta e Scopri" — Vision Challenge
Il giocatore riceve una sfida: *"Trova e fotografa qualcosa di circolare su questo edificio"*. Scatta la foto, Claude Vision la analizza e conferma se la sfida è completata. Gamification sensoriale reale: non guardi il telefono, guardi la città.

---

## MVP per l'hackathon (scope realistico)

**Cosa dimostrare in demo:**

1. Onboarding → inserisci città + profilo in 30 secondi
2. Board generata → 8-10 tappe visualizzate su mappa + board grafica
3. Almeno 3 tipi di casella funzionanti (Quiz, Micro-storia, Curiosità)
4. Contenuto realmente diverso tra due profili diversi sulla stessa città
5. Funzionante in italiano e inglese
6. UI mobile-friendly (PWA)

**Cosa lasciare fuori dal MVP:**
- Multiplayer (troppo complesso, si racconta come visione)
- GPS reale in Modalità Campo (si mostra il wireframe/mockup)
- Database persistente utenti (session-based è sufficiente)
- AR location-based completa (si dimostra la Vision Challenge che è più d'impatto e fattibile)

**Per l'AR nel MVP — focus su "Scatta e Scopri":**
- Apri fotocamera nel browser (MediaDevices API, nativa nei browser moderni)
- Scatta foto della tappa quando sei in Modalità Campo
- Invia a Claude Vision API → conferma sfida + genera commento personalizzato
- Nessuna libreria AR pesante necessaria per la demo: impatto visivo garantito con implementazione rapida

---

## Messaggio per la giuria

> Il turismo di massa è finito. La Gen Z non vuole la guida turistica — vuole giocare, scoprire, connettersi. Play The City non usa l'AI per generare testo: la usa per costruire connessioni nascoste tra luoghi, persone e storia. La città non è uno sfondo — è il personaggio principale.

---

## Struttura repo (proposta)

```
/
├── frontend/          # Next.js PWA
│   ├── app/
│   │   ├── page.tsx           # onboarding / home
│   │   ├── board/[gameId]/    # board di gioco
│   │   └── tappa/[poiId]/     # scheda tappa + AR
│   └── components/
│       ├── GameBoard.tsx
│       ├── TappaCard.tsx
│       ├── QuizModal.tsx
│       ├── ARCamera.tsx        # fotocamera + invio foto a Claude Vision
│       └── AROverlay.tsx       # overlay AR su stream fotocamera (A-Frame/AR.js)
├── backend/           # FastAPI
│   ├── main.py
│   ├── city_generator.py      # OSM + Wikipedia → POI
│   ├── personalization.py     # filtraggio per profilo
│   ├── ai_engine.py           # chiamate Claude API (testo + vision)
│   ├── vision_engine.py       # analisi foto con Claude Vision → conferma sfide
│   └── game_builder.py        # assembla il game object
└── idea.md
```
