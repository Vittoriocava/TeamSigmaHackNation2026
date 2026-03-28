# Play The City — Implementazione & Setup Guide

> HackNation 2026 · Team Sigma

---

## Cos'è Play The City

App mobile-first che trasforma il turismo in un gioco a territorio. Ogni luogo è una risorsa da conquistare, difendere o rubare agli altri giocatori.

**Due modalità:**
- **Da Casa** — prepara il viaggio: quiz live, swipe dei posti, difendi i tuoi territori
- **Mobile** — in città: board game su mappa reale, AR, audio guide, sfide GPS

---

## Architettura generale

```
Browser (PWA)
    │
    ├── Next.js 15 (App Router) ── Supabase JS (auth + realtime)
    │
    └── FastAPI (Python)
            ├── Claude API       (quiz, storie, ranking, vision)
            ├── OpenAI DALL-E 3  (immagini storiche timeline)
            ├── ElevenLabs       (narrazione audio TTS)
            ├── Overpass API     (POI OpenStreetMap)
            └── Wikipedia API    (descrizioni luoghi)

Database: Supabase (PostgreSQL + Auth + Realtime)
```

---

## Frontend — Struttura pagine

| Route | Descrizione |
|-------|-------------|
| `/auth` | Login / Registrazione (Supabase Auth) |
| `/onboarding` | Quiz 8 domande per profilare il giocatore |
| `/` | Home: cerca città, viaggi attivi, quick actions |
| `/swipe` | Tinder dei posti — swipe left/right su POI |
| `/board/[gameId]` | Board di gioco: mappa + 8-15 tappe con contenuto AI |
| `/tappa/[poiId]` | Dettaglio POI: info, timeline storica, AR, pezzi |
| `/territorio` | Mappa territori conquistati, decay timer |
| `/quiz-live` | Lobby quiz live (join/create room) |
| `/quiz-live/[roomCode]` | Quiz multiplayer in tempo reale |
| `/scopri` | Guida città senza gioco |
| `/profilo` | Profilo, stats, classifica globale/per città |

### Flusso navigazione

```
/auth ──► /onboarding ──► /
                           ├── /swipe
                           ├── /quiz-live/[roomCode]
                           ├── /territorio
                           ├── /board/new?city=Roma&mode=solo
                           │       └── /board/[gameId]
                           │               └── /tappa/[poiId]
                           └── /profilo
```

### State management

Zustand con `persist` (localStorage). Store principale (`src/lib/store.ts`):

```ts
{
  user: User | null       // info utente loggato
  profile: Profile | null // interessi, livello culturale, lingua
  currentGame: GameState  // board attiva con stops
  token: string | null    // JWT Supabase
  coins: number
}
```

---

## Backend — Struttura moduli

```
backend/
├── main.py                    # FastAPI app, CORS, routers, leaderboard
├── run.py                     # uvicorn launcher (python run.py)
└── app/
    ├── config.py              # Settings da .env (pydantic-settings)
    ├── db.py                  # Supabase client (lazy init)
    ├── auth.py                # Dipendenza JWT: get_current_user
    ├── models.py              # Tutti i Pydantic models
    ├── routers/
    │   ├── city.py            # GET /{city}/pois, POST /{city}/rank
    │   ├── game.py            # POST /create, GET /{id}, POST /{id}/complete-stop
    │   ├── audio.py           # POST /narrate (ElevenLabs TTS)
    │   ├── vision.py          # POST /analyze (Claude Vision), /timeline/{poi}
    │   ├── quiz.py            # CRUD sessioni quiz, submit risposta
    │   ├── territory.py       # Conquista, difesa, decay
    │   ├── timeline.py        # GET /timeline/{poi} (DALL-E immagini storiche)
    │   ├── profile.py         # GET/PATCH profilo, POST /infer, POST /swipe
    │   └── presence.py        # PUT /presence, GET /{city}/active
    └── services/
        ├── ai.py              # Tutti i call Claude: quiz, storie, curiosità, ranking
        └── coins.py           # award_coins, spend_coins, get_balance
```

### I 5 Agenti AI

| Agente | File | Cosa fa |
|--------|------|---------|
| **POI Generator** | `routers/city.py` + `services/ai.py:rank_pois` | Scarica POI da OSM, arricchisce con Wikipedia, li rankia con Claude in base al profilo utente |
| **Board Generator** | `routers/game.py` | Crea la board di gioco completa: seleziona tappe, assegna tipi (quiz/story/ar/...), genera contenuto AI per ognuna |
| **Audio Guide** | `routers/audio.py` | Genera narrazione con Claude, la converte in audio con ElevenLabs TTS, ritorna stream |
| **Vision AR** | `routers/vision.py` | Analizza foto con Claude Vision (identifica il luogo), genera immagini storiche con DALL-E 3 |
| **Quiz Agent** | `routers/quiz.py` + `services/ai.py:generate_quiz` | Genera domande quiz uniche per POI, gestisce sessioni multiplayer, anti-ripetizione con hash |

---

## Database — Tabelle principali

| Tabella | Scopo |
|---------|-------|
| `users` | Profilo base (display_name, level, xp) |
| `profiles` | Interessi, lingua, livello culturale, pace |
| `games` | Board di gioco (board_json JSONB con tutte le tappe) |
| `game_players` | Punteggi e POI sbloccati per giocatore |
| `territories` | POI conquistati, tier, decay timer |
| `quiz_sessions` | Sessioni quiz live con room_code |
| `coins` / `coin_transactions` | Economia in-game |
| `temporal_images` | Cache DALL-E 3 (evita rigenera stessa immagine) |
| `presence` | Posizione realtime giocatori per città |
| `leaderboard` | Materialized view (rank_score = xp + territories*100 + score) |

**Trigger automatici:**
- `on_auth_user_created` → crea `users`, `profiles`, `coins` al signup
- `profiles_updated_at` → aggiorna `updated_at` su ogni modifica profilo

**RLS attivo** su tutte le tabelle. Refresh leaderboard: `SELECT refresh_leaderboard();`

---

## Setup — Guida completa

### 1. Supabase

1. Crea un nuovo progetto su [supabase.com](https://supabase.com)
2. Vai su **SQL Editor** → incolla ed esegui `supabase/migrations/001_initial_schema.sql`
3. Vai su **Project Settings → API** e copia:
   - `Project URL` → `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `SUPABASE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_KEY`
   - `JWT Secret` (Settings → API → JWT Settings) → `JWT_SECRET`

### 2. API Keys esterne

| Servizio | Come ottenere | Variabile |
|----------|---------------|-----------|
| **Regolo.ai** | [dashboard.regolo.ai](https://dashboard.regolo.ai) → Virtual Keys → crea chiave "All models" | `REGOLO_API_KEY` |
| **ElevenLabs** | [elevenlabs.io](https://elevenlabs.io) → Profile → API Key | `ELEVENLABS_API_KEY` |
| **ElevenLabs Voice** | Scegli voice ID dal catalogo (default: Rachel) | `ELEVENLABS_VOICE_ID` |

**Modelli Regolo (configurabili via .env):**

| Variabile | Default | Uso |
|-----------|---------|-----|
| `REGOLO_CHAT_MODEL` | `Llama-3.3-70B-Instruct` | Quiz, storie, ranking POI, curiosità |
| `REGOLO_VISION_MODEL` | `Llama-3.2-11B-Vision-Instruct` | Analisi foto AR, souvenir |
| `REGOLO_IMAGE_MODEL` | `flux-dev` | Generazione immagini storiche timeline |

> Tutti i modelli vengono scelti dal catalogo disponibile nel tuo progetto Regolo. L'SDK usato è `openai` Python con `base_url="https://api.regolo.ai/v1"`.

### 3. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Compila .env con tutte le chiavi

python run.py                 # oppure: uvicorn main:app --reload
# API disponibile su http://localhost:8000
# Docs: http://localhost:8000/docs
```

### 4. Frontend

```bash
cd frontend
npm install

# Crea frontend/.env.local con:
# NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
# App su http://localhost:3000
```

### 5. Verifica

1. Apri `http://localhost:3000/auth` → registra un account
2. Completa onboarding
3. Cerca una città (es. "Roma") → la board si genera con AI
4. Backend logs: `http://localhost:8000/docs` per testare endpoint

---

## TODO — Cose mancanti / da completare

### Critico (blocca il demo)

- [ ] **`frontend/.env.local`** — file non committato, va creato manualmente (vedi Setup §4)
- [ ] **`backend/.env`** — idem, va creato da `.env.example`
- [ ] **`/board/new` route** — la pagina `/board/new?city=Roma` non esiste ancora: va creata per mostrare loading mentre il backend genera la board, poi redirect a `/board/[gameId]`
- [ ] **Connessione reale board** — `app/board/[gameId]/page.tsx` usa dati mock, va integrato con `GET /api/game/{gameId}` del backend
- [ ] **Connessione reale profilo** — `app/profilo/page.tsx` usa dati mock, va integrato con `GET /api/profile/me`

### Importanti (funzionalità parziali)

- [ ] **Swipe API** — `app/swipe/page.tsx` ha il TODO `apiPost('/api/profile/swipe')` commentato
- [ ] **Territorio API** — `app/territorio/page.tsx` usa dati mock, va collegato a `GET /api/territory/my`
- [ ] **Quiz live realtime** — il multiplayer usa mock, va collegato a Supabase Realtime (tabella `quiz_session_players`)
- [ ] **Audio guide** — `app/tappa/[poiId]/page.tsx` ha bottone play ma non chiama `POST /api/audio/narrate`
- [ ] **Timeline DALL-E** — la tab Timeline nel POI detail mostra immagini placeholder, va collegata a `GET /api/timeline/{poiId}`
- [ ] **AR Vision** — tab AR chiama la fotocamera ma non manda a `POST /api/vision/analyze`
- [ ] **Scopri page** — usa POI mock, va collegata a `GET /api/city/{city}/pois`

### Minori / polish

- [ ] **Presenza realtime** — `PUT /api/presence` va chiamato con geolocalizzazione browser quando l'utente è in modalità Mobile
- [ ] **Refresh leaderboard** — configurare un cron job su Supabase o chiamare `SELECT refresh_leaderboard()` periodicamente
- [ ] **PWA manifest** — verificare che `frontend/public/manifest.json` esista e sia configurato
- [ ] **Notifiche decay** — la home mostra mock alerts, va collegata a query territories in scadenza
- [ ] **Pagina `/board/new` con form** — scegliere modalità (solo/gruppo/aperta) prima di creare la board
- [ ] **Gestione errori** — aggiungere fallback UI quando il backend non è raggiungibile

### Ottimizzazioni post-hackathon

- [ ] Cache OSM + Wikipedia in Supabase (evitare chiamate ripetute per stessa città)
- [ ] Rate limiting su endpoint AI (Claude + DALL-E costosi per richiesta)
- [ ] WebSocket per quiz live invece di polling Supabase Realtime
- [ ] Deploy: Vercel (frontend) + Railway/Render (backend)

---

## Endpoint backend — Reference rapida

```
GET  /                                → health check
GET  /api/city/{city}/pois            → POI grezzi OSM
POST /api/city/{city}/rank            → POI rankati da Claude (body: UserProfile)
POST /api/game/create                 → crea board (body: CreateGameRequest) 🔒
GET  /api/game/{gameId}               → board completa + giocatori
POST /api/game/{gameId}/complete-stop/{poiId}  → completa tappa 🔒
POST /api/audio/narrate               → TTS narrazione (body: NarrationRequest)
POST /api/vision/analyze              → analisi foto Claude Vision 🔒
GET  /api/timeline/{poiId}            → immagini storiche DALL-E
GET  /api/quiz/sessions/{city}        → sessioni quiz attive
POST /api/quiz/sessions               → crea sessione 🔒
POST /api/quiz/{sessionId}/start      → avvia sessione 🔒
POST /api/quiz/{sessionId}/answer     → invia risposta 🔒
GET  /api/territory/my                → miei territori 🔒
POST /api/territory/conquer           → conquista POI 🔒
POST /api/territory/defend/{poiId}    → difendi territorio 🔒
GET  /api/profile/me                  → profilo utente 🔒
PATCH /api/profile/me                 → aggiorna profilo 🔒
POST /api/profile/infer               → deduce profilo da quiz + swipe
PUT  /api/presence                    → aggiorna posizione 🔒
GET  /api/presence/{city}/active      → giocatori attivi in città
GET  /api/leaderboard                 → classifica globale
GET  /api/leaderboard/city/{slug}     → classifica per città

🔒 = richiede header Authorization: Bearer <supabase_jwt>
```

---

## Variabili d'ambiente — Riepilogo

### `backend/.env`
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=eyJ...             # anon key
SUPABASE_SERVICE_KEY=eyJ...     # service_role key
REGOLO_API_KEY=...              # da dashboard.regolo.ai → Virtual Keys
REGOLO_CHAT_MODEL=Llama-3.3-70B-Instruct
REGOLO_VISION_MODEL=Llama-3.2-11B-Vision-Instruct
REGOLO_IMAGE_MODEL=flux-dev
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
JWT_SECRET=...                  # da Supabase Project Settings → API → JWT Secret
```

### `frontend/.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=http://localhost:8000
```
