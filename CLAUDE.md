# CLAUDE.md

## Project

**Play The City** — HackNation 2026 hackathon project by Team Sigma. An app that combines territory conquest game, intelligent city guide, and AI-powered virtual tourist guide. Two modes: **Da Casa** (home: quiz, swipe, territory defense) and **Mobile** (field: GPS, AR, audio guide, board game).

## Architecture

- **Frontend**: Next.js 15 (App Router) + React 19 + TailwindCSS + Framer Motion + Leaflet.js — PWA mobile-first
- **Backend**: FastAPI (Python) — AI engine, game logic, external API orchestration
- **Database**: Supabase (PostgreSQL + Auth + Realtime)
- **AI**: Claude API (quiz, stories, vision, ranking) + DALL-E 3 (timeline images) + ElevenLabs (narration TTS)

## Commands

### Frontend (`frontend/`)
```bash
cd frontend
npm install            # install dependencies
npm run dev            # dev server (localhost:3000)
npm run build          # production build
```

### Backend (`backend/`)
```bash
cd backend
pip install -r requirements.txt   # install dependencies
cp .env.example .env              # configure API keys
uvicorn main:app --reload         # dev server (localhost:8000)
```

### Database
```bash
# Apply schema to Supabase project
# Copy supabase/migrations/001_initial_schema.sql into Supabase SQL editor
```

## Key Files

### Backend structure
```
backend/
├── main.py                    # FastAPI app entry point
├── run.py                     # uvicorn launcher
├── requirements.txt
└── app/
    ├── config.py              # Settings (API keys via .env)
    ├── db.py                  # Supabase client
    ├── auth.py                # JWT auth dependency
    ├── models.py              # Pydantic models
    ├── routers/
    │   ├── city.py            # Agent 1: POI Generator (OSM + Wikipedia)
    │   ├── game.py            # Agent 2: Itinerary + Board Generator
    │   ├── audio.py           # Agent 3: Audio/Voice Guide (ElevenLabs)
    │   ├── vision.py          # Agent 4: Vision AR (Claude Vision + DALL-E)
    │   ├── quiz.py            # Agent 5: Quiz Agent (multiplayer + solo)
    │   ├── territory.py       # Territory conquest, decay, defense
    │   ├── timeline.py        # Timeline images (Claude → DALL-E 3)
    │   ├── profile.py         # User profile + personalization
    │   └── presence.py        # Realtime presence
    └── services/
        ├── ai.py              # Core Claude API wrapper (all AI functions)
        └── coins.py           # Coin economy (award, spend, balance)
```

### Frontend pages
- `frontend/src/app/page.tsx` — Home: "Dove andiamo?" + quick actions
- `frontend/src/app/onboarding/page.tsx` — Gamified quiz for profile creation
- `frontend/src/app/swipe/page.tsx` — Tinder dei Posti (DA CASA)
- `frontend/src/app/board/[gameId]/page.tsx` — Game board with map + stops (MOBILE)
- `frontend/src/app/tappa/[poiId]/page.tsx` — POI detail: timeline, AR, pieces
- `frontend/src/app/territorio/page.tsx` — Territory map + defense (DA CASA)
- `frontend/src/app/quiz-live/[roomCode]/page.tsx` — Live multiplayer quiz (DA CASA)
- `frontend/src/app/scopri/page.tsx` — City guide (non-game browsing)
- `frontend/src/app/profilo/page.tsx` — Profile, stats, leaderboard
