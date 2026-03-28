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

### Backend engines (5 AI agents from AI_AGENT.md)
- `backend/city_generator.py` — Agent 1: POI Generator (OSM + Wikipedia + Claude ranking)
- `backend/game_builder.py` — Agent 2: Itinerary + Board Generator
- `backend/audio_engine.py` — Agent 3: Audio/Voice Guide (Claude + ElevenLabs)
- `backend/vision_engine.py` — Agent 4: Vision AR (Claude Vision + DALL-E)
- `backend/quiz_session.py` — Agent 5: Quiz Agent (multiplayer + solo)
- `backend/ai_engine.py` — Core AI module (Claude API wrapper for all agents)
- `backend/territory_engine.py` — Territory conquest, decay, defense
- `backend/image_engine.py` — Timeline images (Claude prompt → DALL-E 3 → cache)

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
