# Play The City — Idea & Stack

## Concept centrale

**"Vivi la città da player, non da turista."**

Un'app che è tre cose insieme:
1. **Gioco di territorio** — conquista posti reali, difendili, sfida altri giocatori
2. **Guida città intelligente** — musei, ristoranti, botteghe, posti instagrammabili, itinerari su misura
3. **Guida turistica virtuale** — narratore AI + timeline storica + AR sul posto

L'AI non è un chatbot. È il motore che conosce il giocatore, costruisce il suo percorso unico, narra i luoghi con voce, genera immagini storiche, adatta difficoltà e contenuto. La città non è uno sfondo — è il personaggio principale.

---

## I tre pilastri dell'app

```
┌─────────────────────┬──────────────────────────┬─────────────────────────┐
│   GIOCO             │   GUIDA CITTÀ            │   GUIDA TURISTICA       │
├─────────────────────┼──────────────────────────┼─────────────────────────┤
│ Conquista territori │ Musei, ristoranti,        │ Narratore AI vocale     │
│ Difendi da casa     │ discoteche, botteghe,     │ Timeline storica        │
│ Quiz multiplayer    │ posti instagrammabili     │ AR sul luogo reale      │
│ Classifica globale  │ Itinerario personalizzato │ Immagini AI epoche past │
│ Territorio + decay  │ Filtro per interessi      │ "Scatta e Scopri"       │
│ Pezzi monumento     │ Mappa posti grigi/colorat │ Carta d'identità città  │
└─────────────────────┴──────────────────────────┴─────────────────────────┘
```

---

## Onboarding e Profilo

### Quiz iniziale (alla registrazione)
Breve quiz gamificato (10 domande, 60 secondi) che calibra subito il profilo:
- Interessi: arte / storia / food / natura / nightlife / architettura / borghi / shopping
- Età (fascia)
- Livello culturale (casual / appassionato / esperto)
- Lingua (italiano, inglese, francese, spagnolo)

Il quiz non è un form — è già un gioco. Rispondi a domande tipo *"Sei a Roma per un pomeriggio. Scegli: Colosseo o Trastevere?"*. L'AI deduce il profilo dalle scelte.

### Tinder dei Posti (a casa, per affinare il profilo)
Sessione di swipe su card di luoghi: immagine + nome + categoria.
- Swipe destra → mi piace, swipe sinistra → non fa per me
- Più swipe fai, più il profilo diventa preciso
- L'itinerario generato cambia in base alle preferenze accumulate
- Funziona anche offline come sessione di "esplora posti" serale
- Per i gruppi: il sistema interseca le preferenze di tutti i membri → itinerario bilanciato

### Livello Giocatore
Basato sul numero di posti fisicamente visitati e conquistati:
- **Livello 1–5** → accesso a POI base (monumenti principali)
- **Livello 6–15** → si sbloccano POI nascosti (cortili, botteghe storiche, belvedere segreti)
- **Livello 16+** → posti esclusivi e sfide avanzate, borghi minori classificati

Il livello è globale, non per città — spinge a esplorare posti nuovi ovunque.

---

## Home Screen — UX principale

```
┌─────────────────────────────────────────────┐
│  🔍  "Dove andiamo?"          [profilo]  [🔔] │
├─────────────────────────────────────────────┤
│  I TUOI VIAGGI                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Roma     │  │ Bologna  │  │ + Nuovo  │  │
│  │ 37% exp. │  │ futuro   │  │ viaggio  │  │
│  └──────────┘  └──────────┘  └──────────┘  │
├─────────────────────────────────────────────┤
│  SCOPRI ORA                                 │
│  • Sessioni quiz live  (3 attive)           │
│  • Posti da difendere  (Tivoli scade tra 2g)│
│  • Suggerimento AI: "Spello è vicina a te" │
└─────────────────────────────────────────────┘
```

**Organizza nuovo viaggio:**
1. Inserisci città (o lascia che l'AI suggerisca in base alla posizione + profilo)
2. Scegli modalità:
   - **Solo** — avventura individuale
   - **Gruppo** — aggiungi compagni di viaggio, il sistema matcha gli interessi
   - **Unisciti a una sessione** — matchmaking con sconosciuti che visitano la stessa città, abbinati per interessi comuni
3. Scegli data (viaggio futuro = prepara i pezzi da casa in anticipo)

---

## Modalità di Gioco

### Modalità Solo
Percorso generato dall'AI al 100% personalizzato sul tuo profilo. Mappa + nebbia di guerra. Conquisti tappe, accumuli monete, costruisci la tua storia della città.

### Modalità Gruppo (compagni noti)
- Stesso board, tappe assegnate o in competizione
- Nebbia si apre per tutti quando qualcuno sblocca una tappa (Supabase Realtime)
- Classifica live durante il viaggio
- Il sistema interseca i profili → include tappe che soddisfano tutti

### Modalità Sessione Aperta (matchmaking)
- Sei solo in città ma vuoi giocare con altri
- Il sistema ti abbina con altri giocatori presenti nella stessa città in quel momento
- Abbinamento per interessi (non per livello — così i novizi imparano dagli esperti)
- Ogni membro vive la sua storia ma vede le tappe degli altri sulla mappa

---

## Sistema Territorio e Conquista

### Mappa: Grigio → Colore
Tutti i POI della città sono visibili sulla mappa fin dall'inizio, ma **grigi** (nebbia sopra di loro). Quando passi fisicamente vicino a un posto (GPS) e completi la tappa → diventa colorato, la nebbia si dissolve. Il colore indica anche lo stato:
- **Grigio** → non visitato
- **Colore pieno** → tuo, conquistato di recente
- **Colore sbiadito** → tuo ma a rischio decay
- **Colore altrui** → conquistato da un altro giocatore

### Pezzi Monumento — Pre-conquista da Casa
Ogni POI importante ha 3 "pezzi" collezionabili da casa:

**Come guadagni pezzi:**
- **Quiz sul posto** → rispondi a domande specifiche su quel luogo (Claude genera)
- **GeoGuessr Roma** → ti mostra un frammento di un monumento/quartiere a caso, indovina dove sei → pezzo

Quando hai tutti e 3 i pezzi di un POI → il posto è "pre-reclamato". Sulla mappa appare con un'icona speciale. Ma **non è tuo finché non ci vai fisicamente**. Questo è il ponte casa-città: costruisci l'attesa, poi realizzi la conquista sul posto.

### Piazza il Tuo Monumento
Quando conquisti fisicamente un posto (GPS verificato), puoi:
- **Conquistarlo gratis** → il posto è tuo per 7 giorni, difendibile con quiz da casa
- **Pagare monete per personalizzarlo** → piazzi il tuo "monumento" personale (avatar, nome, frase) visibile a tutti i giocatori che visitano quel posto

**Il Monumento porta valore:**
- Altri giocatori che arrivano sul posto vedono il tuo monumento
- Possono "salutarti" (like) → tu guadagni monete passive
- Il quiz che fanno sul posto **lo scegli tu** (tra quelli generati dall'AI) — sei tu il padrone di casa
- Più saluti ricevi, più monete accumuli anche senza giocare attivamente

### Decay e Difesa
La proprietà dura **1 settimana**. Poi:
- **Da casa**: fai un quiz specifico su quel posto → rinnovi per un'altra settimana
- **In città**: torni fisicamente → rinnovi + guadagni bonus monete
- **Se non difendi**: il posto torna grigio e contendibile

**Achievement per continuità:**
- "Guardiano" → difesa per 2 settimane consecutive
- "Custode" → 1 mese consecutivo
- "Leggenda" → 3 mesi (praticamente imbattibile, motiva il ritorno fisico)

**Vecchi proprietari**: ogni posto conserva la storia di chi lo ha posseduto. Nel profilo hai:
- **Proprietà attive** — posti che possiedi ora
- **Proprietà passate** — tutti i posti che hai mai conquistato, con date

### Il Ciclo Casa ↔ Città

```
[A CASA]
Swipe Tinder posti → affini profilo
Quiz Colosseo → accumuli pezzi
Sessione quiz live → guadagni monete
Difendi Tivoli con quiz → rinnovi proprietà
        ↓ (il gioco crea urgenza di uscire)
[IN CITTÀ]
GPS sblocca tappa → nebbia si dissolve
Completi 3 pezzi Colosseo → lo conquisti
Piazzi il tuo monumento (monete) → guadagno passivo
Visiti posto altrui → fai il quiz del proprietario
        ↓ (torni a casa con nuovo territorio da difendere)
[A CASA — ritorno]
Decay Tivoli tra 5 giorni → devo tornare o fare quiz
Nuova città suggerita dall'AI → nuovo ciclo
```

---

## Meccaniche di Gioco

### Board di Esplorazione
10–15 tappe per partita, generate dall'AI in base al profilo. Visibili sulla mappa come percorso. Caselle tipo:
- **Tappa Storia** → micro-storia narrata dall'AI (ElevenLabs voce)
- **Quiz** → domanda a scelta multipla, difficoltà adattiva al livello
- **Sfida Locale** → "trova una bottega storica in questo quartiere"
- **Curiosità Nascosta** → fatto sorprendente, la città sotto la superficie
- **Connessione** → link tra due luoghi lontani nel tempo ma vicini nel senso
- **Sfida AR** → in Modalità Campo, inquadra il luogo con la fotocamera per sbloccare
- **GeoGuessr** → "indovina in che quartiere sei" con frammento di monumento

### Sessioni Quiz Online (a casa)
Lobby pubblica o privata (codice stanza), 2–8 giocatori, domande generate da Claude su una città. Come Kahoot ma il contenuto è generato live e personalizzato. Monete proporzionali al punteggio. È la modalità che tiene vivo il gioco senza uscire.

### Itinerario AI
L'app non è solo gioco — genera anche un **itinerario pratico** per la città:
- Come spostarsi (trasporti, piedi, bici) tra le tappe
- Orari di apertura (da OSM + Google Places API)
- Stima tempi
- Filtrato per le preferenze del profilo (niente musei se hai swipato sinistra su tutti)

### Guida Città — Sezione Scopri
Sezione non-gioco dell'app, navigabile liberamente:
- **Posti instagrammabili** (tag OSM + curazione AI)
- **Ristoranti e food** per categoria (Claude genera descrizione + perché fa per te)
- **Vita notturna** (discoteche, bar, eventi)
- **Musei e cultura** con info biglietti
- **Biblioteche, spazi studio, coworking**
- Tutti i posti anche qui appaiono grigi se non visitati, colorati se già esplorati — la mappa è unica

---

## Feature Tecnologiche Differenzianti

### Linea Temporale con Immagini AI Generate
Timeline orizzontale su ogni tappa:
```
[100 d.C.] → [1200] → [1800] → [1950] → [Oggi]
 DALL-E 3    DALL-E 3  foto epoca  foto    Street View
```
Claude genera il prompt storico → DALL-E 3 genera l'immagine → cachata in DB.
Esempio: *"Il Foro Romano nel 100 d.C., fotorealistico, luce tramonto, romani in toga, colonne integre"*

### AR Fotocamera — due esperienze distinte

**1. "Come era" — Viaggio nel Tempo**
Scatti una foto del luogo (edificio, piazza, monumento). Claude Vision riconosce il posto → recupera l'immagine DALL-E già generata per quell'epoca → la sovrappone come overlay semi-trasparente sulla foto scattata. L'utente vede in un'unica immagine il luogo oggi e come appariva nell'antichità. Può scorrere un cursore per dissolvere tra presente e passato. La foto risultante è salvabile e condivisibile — ogni condivisione è promozione organica dell'app.

**2. "Foto col Monumento" — Souvenir AI**
Scatti un selfie o una foto davanti al monumento. Claude Vision identifica il luogo e il soggetto → compone una foto finale che integra il giocatore nella scena storica generata da DALL-E (es: sei tu davanti al Colosseo ma il Colosseo è integro, anno 80 d.C., con la folla romana). Non un filtro generico — una ricostruzione contestuale e personalizzata. La foto ha il watermark "Play The City" e viene salvata nel profilo come ricordo della conquista.

### Narratore Vocale (ElevenLabs)
Ogni micro-storia letta da una voce generata. Tono adattivo al profilo (bambino → voce calda, esperto → voce densa). Voce-personaggio diversa per città (Roma solenne, Napoli vivace). In auricolare mentre si cammina — la città parla senza guardare lo schermo.

### Giocatori Attivi in Tempo Reale
Dot animati sulla mappa: "3 persone stanno esplorando Roma ora", "1 a Civita di Bagnoregio". Supabase Realtime, presenza anonima aggregata, TTL 5 minuti.

### Borghi Italiani — Copertura Capillare
Funziona per qualsiasi comune italiano, anche sotto i 500 abitanti. OSM + Wikidata coprono tutto. Dove Wikipedia è scarna, Claude genera contenuto dai dati strutturati (coordinate, anno fondazione, monumenti censiti). Un borgo delle Marche diventa un'avventura unica — anzi di più, perché nessuno lo conosce già.

### Micro-turismo e Turismo di Prossimità
Il decay del territorio è il motore. Non una notifica push — è la mappa che mostra il tuo colore che sbiadisce, qualcuno che si avvicina al tuo borgo. Tivoli è a 30 km da Roma. Spello a 2 ore. Il gioco crea urgenza narrativa per andare dove normalmente non si andrebbe. Questo è il pitch per comuni e pro loco: promozione territoriale che funziona perché il giocatore è già motivato internamente.

---

## Classifiche

- **Globale** — top player per punti totali
- **Per città** — chi domina Roma, chi domina Napoli
- **Borghi** — territori unici conquistati (incentiva posti meno noti)
- **Guardiani** — chi mantiene il territorio più a lungo
- **Quiz Settimanale** — reset ogni lunedì, sempre fresca e competitiva
- **Revenue passiva** — chi genera più monete dai saluti sul proprio monumento

Tutte alimentate da view materializzate in Supabase. Aggiornamento Realtime, nessun polling.

---

## Stack Tecnico

### Frontend (Web + Mobile — unica codebase)
- **Next.js 15** (App Router) + **React** → PWA installabile su mobile, funziona su PC
- **TailwindCSS** + **Framer Motion** → UI game-feel, animazioni nebbia, transizioni mappa
- **Leaflet.js** → mappa interattiva open-source, layer canvas per nebbia di guerra
- **Geolocation API** → verifica presenza fisica per conquiste
- **AR.js** + **A-Frame** → AR web-based, zero installazione
- **MindAR.js** → riconoscimento visivo luoghi/targhe
- **MediaDevices API** → fotocamera per "Scatta e Scopri"

### Backend / API
- **FastAPI** (Python) → logica di gioco, AI engine, gestione sessioni quiz
- **Supabase** → PostgreSQL + Auth (email + Google OAuth) + Realtime

> **Registrazione: Supabase, non backend custom.** Auth, sessioni JWT, profili, monete, classifica — tutto Supabase. FastAPI riceve il JWT e lo verifica con la chiave pubblica. Zero codice auth da scrivere.

### AI Layer
- **Claude API** → quiz, micro-storie, narrativa, Vision per sfide foto, prompt DALL-E, itinerari
- **DALL-E 3 (OpenAI)** → immagini storiche per la linea temporale
- **ElevenLabs API** → text-to-speech adattivo, stream diretto nel browser
- **Wikipedia REST API** + **Wikidata** → fonte dati verificabile
- **Overpass API (OSM)** → POI di qualsiasi comune italiano
- **ISTAT open data** → copertura borghi minori non su Wikipedia

### Infrastruttura
- **Vercel** → deploy Next.js
- **Railway** → deploy FastAPI

---

## Architettura del Sistema

```
[Registrazione + Quiz profilo iniziale]
            ↓
    [Profilo Engine]
    Interessi, livello, lingua, swipe history
            ↓
    [City Generator]
    OSM + Wikipedia + Wikidata → POI bilanciati per profilo
    (storia, arte, food, natura, nightlife, borghi, instagrammabili)
            ↓
    [Personalization Engine]
    Filtra per livello giocatore + interessi + swipe history
    Per gruppi: intersezione profili → tappe condivise
            ↓
    [Game Board Generator]
    Board + itinerario pratico (percorso, tempi, trasporti)
            ↓
    [Claude AI Engine]  ← cuore
    Per ogni tappa:
    - Quiz adattativi (3 difficoltà)
    - Micro-storia + prompt ElevenLabs
    - Prompt DALL-E per linea temporale
    - Curiosità nascosta
    - Connessione narrativa con tappa precedente
            ↓
    [Game Loop]
    GPS → sblocco fisico → conquista territorio
    Mappa: grigio → colore, nebbia → dissolve
    Monete, pezzi, achievement
            ↓
    [AR Layer] (Modalità Campo)
    Fotocamera → Claude Vision → sfida confermata
    A-Frame → overlay storico sul luogo reale
```

---

## Schema Database Supabase

```sql
users               → id, email, display_name, avatar, level, created_at
profiles            → user_id, age_range, interests[], language, cultural_level
swipe_history       → user_id, poi_id, liked, created_at
games               → id, city, board_json, mode (solo/group/open), created_at
game_players        → game_id, user_id, score, unlocked_pois[], completed_at
teams               → id, room_code, game_id, name
team_members        → team_id, user_id
territories         → user_id, poi_id, conquered_at, last_defended_at, tier(1/2/3), weeks_held
territory_history   → poi_id, user_id, from_date, to_date  ← vecchi proprietari
monuments           → user_id, poi_id, label, avatar_url, quiz_id_chosen, active
monument_likes      → monument_id, from_user_id, created_at  ← "saluti"
poi_pieces          → user_id, poi_id, pieces_collected(0-3)
coins               → user_id, balance, lifetime_earned
coin_transactions   → user_id, amount, reason, ref_id, created_at
quiz_sessions       → id, room_code, city, host_user_id, status, created_at
quiz_session_players → session_id, user_id, score, coins_earned
quiz_results        → user_id, poi_id, correct, time_ms, created_at
presence            → user_id, city_slug, last_seen  (TTL 5 min)
temporal_images     → poi_id, era_label, image_url, dalle_prompt, created_at  ← cache
leaderboard         → (view materializzata) user_id, city, total_score, territories_held
```

---

## MVP per l'Hackathon (scope realistico)

**Cosa dimostrare in demo:**
1. Onboarding con quiz profilo → 60 secondi
2. Home screen con "Dove andiamo?" → scegli Roma
3. Mappa con nebbia di guerra → POI grigi che diventano colorati
4. Board generata con 8 tappe diverse per due profili diversi
5. Almeno 3 tipi di casella funzionanti: Quiz, Micro-storia (ElevenLabs), Linea Temporale (DALL-E)
6. "Scatta e Scopri" con fotocamera → Claude Vision risponde
7. Classifica globale live
8. Funzionante in italiano e inglese, mobile-first

**Cosa si racconta ma non si costruisce:**
- GPS reale (mockato in demo con posizione fissa)
- Sistema pezzi + monumento (si mostra wireframe)
- Matchmaking sessione aperta (si racconta il loop)
- Decay settimanale (si mostra la UI ma senza cron job reale)

---

## Struttura Repo

```
/
├── frontend/
│   ├── app/
│   │   ├── page.tsx                  # home — "Dove andiamo?"
│   │   ├── onboarding/               # quiz profilo iniziale
│   │   ├── swipe/                    # Tinder dei posti
│   │   ├── board/[gameId]/           # board di gioco
│   │   ├── tappa/[poiId]/            # scheda tappa + timeline + AR
│   │   ├── territorio/               # mappa proprietà + decay
│   │   ├── quiz-live/[roomCode]/     # sessione quiz multiplayer
│   │   ├── scopri/                   # guida città (non-game)
│   │   └── profilo/                  # proprietà attive/passive, achievements
│   └── components/
│       ├── Map/FogOfWar.tsx          # layer nebbia su Leaflet
│       ├── Map/ActivePlayers.tsx     # dot giocatori in tempo reale
│       ├── Board/GameBoard.tsx
│       ├── Board/TappaCard.tsx
│       ├── Board/QuizModal.tsx
│       ├── Timeline/TemporalSlider.tsx # slider epoche + immagini DALL-E
│       ├── AR/ARCamera.tsx           # fotocamera + Claude Vision
│       ├── AR/AROverlay.tsx          # overlay A-Frame
│       ├── Swipe/PlaceCard.tsx       # card Tinder dei posti
│       └── Audio/NarratorPlayer.tsx  # ElevenLabs audio stream
├── backend/
│   ├── main.py
│   ├── city_generator.py             # OSM + Wikipedia + Wikidata → POI
│   ├── personalization.py            # filtraggio profilo + matching gruppo
│   ├── ai_engine.py                  # Claude API (testo + vision)
│   ├── image_engine.py               # Claude prompt → DALL-E 3 → cache
│   ├── audio_engine.py               # testo → ElevenLabs stream
│   ├── vision_engine.py              # Claude Vision → conferma sfide foto
│   ├── territory_engine.py           # decay, tier, sfide, vecchi proprietari
│   ├── coin_engine.py                # earn/spend/transazioni monete
│   ├── quiz_session.py               # lobby multiplayer (Supabase Realtime)
│   ├── presence_engine.py            # giocatori attivi ora per città
│   └── game_builder.py               # assembla il game object completo
└── idea.md
```

---

## Messaggio per la Giuria

> Il turismo di massa è finito. La Gen Z non vuole la guida — vuole giocare, conquistare, difendere. Play The City non usa l'AI per generare testo: la usa per costruire connessioni nascoste tra luoghi, persone e storia. Il territorio che decade dopo una settimana non è un dark pattern — è il motivo per cui il giocatore torna a Tivoli di sabato pomeriggio. Quel borgo ignorato che nessuno visita? Ora ha un Guardiano. E il Guardiano ci torna.
