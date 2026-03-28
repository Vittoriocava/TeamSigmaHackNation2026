# Play The City — Team Sigma @ HackNation 2026

App gamificata per scoprire le città italiane: conquista territori, gioca quiz multiplayer, e ascolta storie AI sui luoghi storici.

---

## Avvio rapido

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # configura le API key (vedi sotto)
uvicorn main:app --reload         # http://localhost:8000
```

### 2. Frontend (Next.js)

```bash
cd frontend
npm install
cp .env.local.example .env.local  # configura le variabili d'ambiente
npm run dev                        # http://localhost:3000
```

### 3. Database (Supabase)

Crea un progetto su [supabase.com](https://supabase.com), poi esegui lo schema:

```
supabase/migrations/001_initial_schema.sql  →  Supabase SQL Editor → Run
```

---

## Variabili d'ambiente

**`backend/.env`**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
REGOLO_API_KEY=your-regolo-api-key
REGOLO_CHAT_MODEL=gpt-oss-120b
REGOLO_VISION_MODEL=Llama-3.2-11B-Vision-Instruct
REGOLO_IMAGE_MODEL=flux-dev
ELEVENLABS_API_KEY=your-elevenlabs-api-key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
JWT_SECRET=your-supabase-jwt-secret
```

**`frontend/.env.local`**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Cos'è

**Play The City** unisce tre esperienze in una sola app:

- **Gioco a territorio** — Conquista POI nelle città, difendi le tue zone dagli altri giocatori
- **Guida AI** — Itinerari personalizzati, storie narrate da AI, timeline storiche con immagini generate
- **Quiz multiplayer** — Sfide in tempo reale sui luoghi della città

Due modalità: **Da Casa** (quiz, swipe, difesa territorio) e **Mobile** (GPS, AR, guida audio sul campo).

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15 (App Router), React 19, TailwindCSS, Framer Motion, Leaflet.js |
| Backend | FastAPI (Python 3.11+) |
| Database | Supabase (PostgreSQL + Auth + Realtime) |
| Mappe | Leaflet + OpenStreetMap / Overpass API |
| AI | Regolo (Claude-compatible) + ElevenLabs TTS |
| State | Zustand |

---

## Struttura

```
TeamSigmaHackNation2026/
├── frontend/          # Next.js app
│   └── src/app/
│       ├── page.tsx           # Home
│       ├── onboarding/        # Quiz profilo iniziale
│       ├── swipe/             # Scopri POI stile Tinder
│       ├── board/[gameId]/    # Tabellone di gioco con mappa
│       ├── tappa/[poiId]/     # Dettaglio POI: timeline, AR
│       ├── territorio/        # Mappa conquista territorio
│       ├── quiz-live/         # Quiz multiplayer
│       ├── scopri/            # Guida città
│       └── profilo/           # Profilo + leaderboard
├── backend/           # FastAPI app
│   └── app/
│       ├── routers/   # city, game, quiz, territory, audio, vision, timeline...
│       └── services/  # ai.py (LLM), coins.py (economia)
└── supabase/
    └── migrations/    # Schema PostgreSQL
```

---

## API Docs

Con il backend avviato: [http://localhost:8000/docs](http://localhost:8000/docs)
