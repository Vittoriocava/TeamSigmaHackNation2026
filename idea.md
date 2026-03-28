# Play The City — Idea & Stack

## Concept centrale

**"Vivi la città da player, non da turista."**

Un gioco digitale board-style (stile Gioco dell'Oca / Monopoli) dove ogni città diventa una mappa da esplorare con tappe, sfide, quiz e storie generate dinamicamente dall'AI — personalizzate sul profilo del giocatore.

Tre modalità di gioco:
- **Modalità Divano** — giochi da casa, esplori la città virtualmente prima di visitarla (o semplicemente per curiosità/cultura)
- **Modalità Campo** — sei fisicamente in città, il GPS sblocca le tappe reali mentre ti muovi
- **Modalità Team** — gruppo di giocatori, stessa città, tappe divise o in competizione — classifica live

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
- **FastAPI** (Python) → logica di gioco, generazione contenuti AI, endpoint game engine
- **Supabase** → PostgreSQL + Auth + Realtime subscriptions

### Registrazione utenti: Supabase, non backend custom
Supabase gestisce tutto: signup/login (email, Google OAuth), sessioni JWT, profili utente, score, classifica. **Non serve scrivere codice di autenticazione**. FastAPI riceve il JWT Supabase e lo verifica — nessun sistema auth duplicato. Il realtime di Supabase gestisce la classifica live e il sync del team senza WebSocket custom.

### AI Layer
- **Claude API (Anthropic)** → generazione quiz, micro-storie, adattamento al profilo, narrativa, Vision per sfide foto
- **DALL-E 3 (OpenAI)** → generazione immagini storiche del luogo per la linea temporale (stesso posto in epoche diverse)
- **Wikipedia REST API** + **Wikidata** → fonte dati affidabile e gratuita per i luoghi
- **Overpass API (OpenStreetMap)** → POI della città, borghi, frazioni (anche comuni sotto 1.000 abitanti)
- **ISTAT open data** + **Touring Club Italiano dataset** → copertura borghi italiani minori non su Wikipedia

### Audio
- **ElevenLabs API** → voce generata per micro-storie, curiosità e narrazione delle tappe. Ogni città può avere un narratore con voce e tono diversi (es. voce antica e solenne per Roma, vivace e ironica per Napoli). Supporto multilingua nativo.

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
  - **Quiz Generale** → domande sulla città non legate a una tappa specifica, usabili come warmup o sfida rapida standalone

### Profilo giocatore (onboarding rapido)
- Età (fascia)
- Interessi (arte / storia / food / natura / nightlife / architettura)
- Lingua (italiano, inglese, francese, spagnolo — Claude multilingue nativo)
- Livello culturale (casual / appassionato / esperto)

### Progressione e Mappa Nebbia di Guerra
La mappa della città parte **completamente coperta da nuvole**. Ogni tappa sbloccata apre la nebbia in quell'area con un'animazione (nuvole che si dissolvono, territorio che emerge). Il progresso è visivo e immediato: vedi quanto hai esplorato vs quanto resta nascosto.

- Punti "Spirito del Luogo" accumulati per ogni tappa
- Percentuale città esplorata visibile sulla mappa (es. "37% sbloccato")
- Badge tematici (es. "Storico", "Foodie", "Esploratore")
- Al termine: **Carta d'Identità della Città** — un riassunto narrativo personalizzato dell'avventura vissuta

Tecnicamente: layer canvas/SVG su Leaflet con celle esagonali o a griglia, opacity 1 → 0 con CSS transition per ogni cella sbloccata. Nessuna libreria extra necessaria.

### Modalità Team
- Il creatore apre una **stanza** (codice a 4 lettere, come Kahoot)
- I membri si uniscono → vedono la stessa mappa, ma ognuno può prendere tappe diverse
- La nebbia si apre in tempo reale per tutti quando qualcuno sblocca una tappa (Supabase Realtime)
- Classifica live in-game durante la partita

### Classifiche
- **Classifica Globale** — top player per punti totali accumulati su tutte le città
- **Classifica per Città** — chi ha esplorato di più Roma, Milano, Napoli...
- **Classifica Team** — punteggio aggregato del gruppo
- **Classifica Quiz Generale** — per la modalità quiz standalone (rapidità + correttezza)
- Aggiornamento real-time via Supabase Realtime, nessun polling

---

## Feature differenzianti (wow factor per la giuria)

### 1. "Lo Spirito del Luogo"
Ogni città ha un filo narrativo invisibile che l'AI costruisce all'inizio e svela progressivamente tappa per tappa. Non una guida: una storia che emerge.

### 2. Layer Botteghe / Commercio Locale
Tra le tappe possono apparire botteghe storiche, mercati, artigiani — non come pubblicità, ma come parte del DNA urbano. Connette cultura e territorio reale.

### 3. Linea Temporale con Immagini AI Generate
Lo stesso luogo in epoche diverse, mostrato visivamente. Claude genera la descrizione storica del posto → DALL-E 3 genera l'immagine di quel luogo nell'epoca specificata. Il giocatore scorre una timeline orizzontale:

```
[Roma 100 d.C.] → [1200 d.C.] → [1800] → [1950] → [Oggi]
   (immagine AI)    (immagine AI)  (foto d'epoca)  (foto)  (Street View)
```

Il prompt a DALL-E viene costruito da Claude: *"Il Foro Romano nel 100 d.C., fotorealistico, luce del tramonto, romani in toga, colonne integre, architettura imperiale romana"*. L'immagine generata appare come illustrazione della tappa — non clip art, ma una ricostruzione visiva credibile. Differenziatore fortissimo rispetto a qualsiasi guida turistica esistente.

### 4. Multiplayer asincrono
Più giocatori, stessa città, board diversa. Alla fine si confrontano le "versioni" della città che hanno scoperto — ognuno ha vissuto un pezzo diverso.

### 5. Borghi Italiani — copertura capillare
Il sistema non si limita a Roma, Milano, Firenze. Funziona per qualsiasi comune italiano, anche quelli sotto i 500 abitanti. OSM ha dati su ogni borgo, Wikidata copre anche i comuni minori. Per i luoghi dove Wikipedia è scarna, Claude genera il contenuto a partire dai dati strutturati di Wikidata (coordinate, popolazione, anno di fondazione, monumenti censiti). Un borgo sperduto delle Marche diventa un'avventura unica quanto il Colosseo — anzi di più, perché nessuno lo conosce già.

### 6. Giocatori Attivi in Tempo Reale sulla Mappa
Nella schermata della mappa (sia in Modalità Divano che Campo) appaiono **dot animati** che mostrano dove altri giocatori stanno esplorando in questo momento. "3 persone stanno giocando a Roma adesso", "1 giocatore a Civita di Bagnoregio". Effetto community immediato — la città non è mai vuota, c'è sempre qualcuno che la sta scoprendo. Tecnicamente: Supabase Realtime + presenza anonima (no dati personali, solo città/quartiere aggregato). Si aggiorna ogni 30 secondi.

### 7. Verified Source Layer
Ogni contenuto mostra la fonte (Wikipedia, Wikidata, OSM) con link. Affidabilità visibile, non dichiarata.

### 8. AR "Occhio del Tempo" (flagship feature)
In Modalità Campo, punti la fotocamera verso un edificio o una piazza. L'AR sovrappone:
- **Layer storico**: come appariva quel luogo 100/500 anni fa (immagini d'epoca + narrazione AI)
- **Personaggi contestuali**: figure storiche legate al luogo appaiono come overlay animati
- **Quiz flottanti**: domande che emergono dal luogo reale inquadrato
- **Dettagli nascosti**: frecce AR che indicano elementi architettonici da cercare (una data, uno stemma, un simbolo)

Tecnicamente: AR.js per location-based + Claude Vision API per analizzare la foto scattata e generare contenuto contestuale in tempo reale.

### 9. Narratore Vocale Personalizzato (ElevenLabs)
Ogni micro-storia e curiosità viene letta da una voce generata da ElevenLabs. Il narratore non è generico: l'AI sceglie tono e registro in base al profilo del giocatore (bambino → voce calda e semplice, esperto → voce colta e densa). La voce del narratore diventa il "personaggio" della partita — la città parla direttamente al giocatore mentre esplora. In Modalità Campo funziona in auricolare mentre si cammina: si sente la storia del luogo senza guardare lo schermo.

### 10. "Scatta e Scopri" — Vision Challenge
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

**Schema database Supabase (tabelle principali):**
```
users          → id, email, display_name, avatar, created_at
profiles       → user_id, age_range, interests[], language, cultural_level
games          → id, city, board_json, created_at
game_players   → game_id, user_id, score, unlocked_pois[], completed_at
teams          → id, room_code, game_id, name
team_members   → team_id, user_id
leaderboard    → user_id, city, total_score, pois_unlocked (view materializzata)
quiz_results   → user_id, poi_id, correct, time_ms, created_at
presence       → user_id, city_slug, last_seen (TTL 5 min, per "giocatori attivi ora")
temporal_images → poi_id, era_label, image_url, dalle_prompt, created_at (cache immagini generate)
```

**Cosa lasciare fuori dal MVP:**
- GPS reale in Modalità Campo (si mostra il wireframe/mockup)
- AR location-based completa (si dimostra la Vision Challenge che è più d'impatto e fattibile)
- Classifica team (si fa la classifica globale e per città, il team si racconta)

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
│   ├── audio_engine.py        # testo → ElevenLabs → audio stream per ogni tappa
│   ├── image_engine.py        # Claude genera prompt → DALL-E 3 → immagine storica per linea temporale
│   ├── presence_engine.py     # giocatori attivi ora per città (Supabase Realtime)
│   └── game_builder.py        # assembla il game object
└── idea.md
```
