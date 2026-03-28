# AI_AGENT.md — Architettura Agenti AI in Play The City

L'app è costruita attorno a **5 agenti principali** in sequenza logica, più agenti di supporto per le feature secondarie. Ogni agente ha un input preciso, un output preciso e un momento di attivazione definito.

---

## Flusso principale degli agenti

```
[Utente: città + profilo]
          │
          ▼
   ┌─────────────┐
   │  AGENTE 1   │  POI Generator
   │             │  → lista posti + ranking + budget
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │  AGENTE 2   │  Itinerary Generator
   │             │  → percorso diviso per giornate + come spostarsi
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │  AGENTE 3   │  Audio/Voice Guide
   │             │  → guida vocale on-demand + proximity GPS + radar posti vicini
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │  AGENTE 4   │  Vision AR
   │             │  → "Come era" + "Foto col Monumento"
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │  AGENTE 5   │  Quiz Agent (da casa)
   │             │  → quiz per posti, conquista territorio, difesa
   └─────────────┘
```

---

## Agente 1 — POI Generator + Ranking + Budget

**Modello:** Claude API + Overpass API (OSM) + Wikipedia REST + Wikidata
**Trigger:** L'utente inserisce una città (o borgo) e il proprio profilo
**Input:**
- Nome città
- Profilo utente: interessi, livello culturale, lingua, età
- Budget (basso / medio / alto)
- Durata del soggiorno (giorni)

**Output:** Lista ranked di POI con metadati completi

### Come funziona

**Step 1 — Fetch dati grezzi:**
- Overpass API → tutti i POI della città (monumenti, musei, mercati, chiese, botteghe, parchi, ristoranti, locali)
- Wikipedia/Wikidata → per ogni POI: descrizione, date storiche, immagini, coordinate
- Per borghi minori dove Wikipedia è scarsa: Claude genera il contenuto dai dati strutturati di Wikidata

**Step 2 — Claude rankizza e filtra:**
```
Input: lista POI grezzi + profilo utente + budget + durata
Output per ogni POI:
  - relevance_score (0–10, quanto è adatto a questo profilo)
  - category (storia / arte / food / natura / nightlife / hidden_gem / ...)
  - estimated_cost (gratuito / € / €€ / €€€)
  - estimated_duration (minuti)
  - crowd_level (basso / medio / alto — da dati OSM + ora del giorno)
  - hidden_gem (bool — posti poco noti ma di alto valore narrativo)
  - why_for_you (frase breve: perché questo posto è giusto per il tuo profilo)
```

**Step 3 — Bilanciamento:**
Claude garantisce un mix bilanciato: non solo musei, non solo food. Rispetta il budget: se budget basso, priorità ai posti gratuiti o economici. Livello giocatore alto → include POI nascosti non visibili ai principianti.

**Output finale:** 20–40 POI candidati ordinati per `relevance_score`, pronti per l'Agente 2.

---

## Agente 2 — Itinerary Generator

**Modello:** Claude API + OSM Routing (OSRM o Valhalla, open source)
**Trigger:** Post Agente 1, quando l'utente conferma il viaggio
**Input:**
- Lista POI rankizzata dall'Agente 1
- Numero di giorni di permanenza
- Profilo movimento: solo a piedi / trasporti pubblici / misto
- Ritmo: lento (pochi posti, approfonditi) / veloce (molti posti, overview)
- Orari disponibili per giornata (opzionale)

**Output:** Itinerario strutturato per giornate con navigazione

### Come funziona

**Step 1 — Claude seleziona e distribuisce:**
- Sceglie i migliori N posti dalla lista (N dipende da giorni × ritmo)
- Distribuisce per giornate: bilancia categorie, distanze, fatica
- Esempio: giornata 1 centro storico, giornata 2 periferia autentica, giornata 3 natura
- Tiene conto degli orari di apertura (da OSM) per non mandare qualcuno a un museo il lunedì

**Step 2 — Routing tra i posti:**
- OSM Routing (OSRM open source, zero costi) calcola il percorso reale tra ogni tappa
- Claude traduce il percorso in istruzioni naturali: *"Dal Pantheon segui via della Rotonda per 3 minuti, giri a sinistra in piazza Navona"*
- Se trasporti pubblici: aggiunge linea bus/metro + fermata (da OSM public transport data)
- Stima tempi realistici: visita + spostamento + margine

**Step 3 — Output strutturato:**
```json
{
  "days": [
    {
      "day": 1,
      "theme": "Roma Antica",
      "stops": [
        {
          "poi_id": "colosseo",
          "arrival_time": "09:30",
          "duration_min": 90,
          "how_to_get_here": "A piedi 12 min da hotel, via Labicana",
          "transport": "piedi",
          "notes": "Arriva presto, entro le 10 è meno affollato"
        },
        ...
      ]
    }
  ]
}
```

L'itinerario viene mostrato come mappa interattiva (Leaflet) con le tappe collegate da linee di percorso, e come lista scrollabile con timeline oraria.

---

## Agente 3 — Audio/Voice Guide

**Modello:** Claude API + ElevenLabs API + Geolocation API (browser)
**Trigger:** Tre modalità di attivazione distinte
**Input:** POI corrente o rilevato + profilo utente
**Output:** Audio narrativo generato e streamato

### Tre modalità di attivazione

**A — On Demand (manuale)**
L'utente è su una scheda POI e preme "Raccontami questo posto". Claude genera la narrazione → ElevenLabs la vocalizza → stream audio parte. Funziona anche senza GPS, anche da casa.

**B — Proximity GPS (semi-automatico)**
Il GPS rileva che l'utente è entro 50 metri da un POI dell'itinerario. Compare un banner: **"Sei vicino al Pantheon — vuoi sapere di più?"** con un countdown di 5 secondi. Se non risponde → accetta automaticamente e l'audio parte. L'utente cammina e ascolta senza guardare lo schermo.

```
GPS position → distanza da ogni POI itinerario
→ se distanza < 50m e POI non ancora visitato oggi
  → mostra banner "Vuoi sapere di più?" (countdown 5s)
  → se accetta o timeout → chiama Claude → ElevenLabs → audio
  → segna POI come "narrato" (non si riattiva per 24h)
```

**C — Radar Posti Vicini (scoperta automatica)**
Mentre l'utente si muove, un processo in background scansiona un raggio di 200 metri e rileva **posti interessanti NON nell'itinerario**. Se trova qualcosa con `relevance_score` alto per quel profilo → genera una narrazione breve (30–60 secondi) e la propone.

Questo è il meccanismo che porta alla scoperta autentica: stai camminando verso il Colosseo e passi davanti a una piccola chiesa medievale che non è nel tuo itinerario. L'agente la riconosce, valuta che sei un appassionato di storia, e ti dice *"Aspetta un secondo — quella chiesa che hai appena superato nasconde qualcosa di insolito..."*

```
ogni 30 secondi (solo se in Modalità Campo):
  → fetch POI entro 200m da OSM (esclusi già narrati, esclusi già in itinerario)
  → passa lista a Claude con profilo utente
  → Claude valuta: c'è qualcosa che vale la pena raccontare?
  → se sì: genera narrazione breve + ElevenLabs → propone all'utente
  → se no: silenzio (non interrompe inutilmente)
```

### Come Claude genera la narrazione

Il tono e il registro sono sempre adattati al profilo. Non script fissi — ogni narrazione è generata live:

```
Prompt base per ogni POI:
"""
Sei la guida vocale di {utente.display_name} a {città}.
POI: {poi_name} — dati: {wikipedia_excerpt} + {wikidata_facts}
Profilo: {interessi}, livello {cultural_level}, lingua {lingua}
Contesto: {modalità: on-demand | proximity | radar}

Per "on-demand": narrazione completa, 2-3 minuti, includi storia, curiosità,
  connessione con il percorso del giorno.
Per "proximity": narrazione media, 60-90 secondi, focus sul perché è speciale
  questo momento (orario, stagione, cosa ha appena visto prima).
Per "radar": narrazione breve, 30-45 secondi, aggancio curioso immediato
  per fermare l'utente.

Parla in prima persona come se fossi il luogo stesso oppure un narratore
che conosce l'utente. Non iniziare mai con il nome del posto.
"""
```

### ElevenLabs — voce adattiva

- Voce scelta in base a profilo + città (Roma → voce profonda; Napoli → cadenza vivace)
- Bambini/famiglie → voce calda, ritmo lento, parole semplici
- Esperti → voce densa, ritmo medio, termini tecnici
- Stream diretto nel browser: l'audio parte entro 1–2 secondi dall'invio del testo

---

## Agente 4 — Vision AR

**Modello:** Claude Vision API + DALL-E 3 + SAM (Segment Anything, via Replicate)
**Trigger:** Utente apre la fotocamera su un POI in Modalità Campo
**Due esperienze:**

### 4a. "Come era" — Viaggio nel Tempo

**Input:** Foto scattata dal luogo + POI attivo + epoca scelta
**Output:** Overlay composito foto reale + ricostruzione storica AI

**Flusso:**
1. Claude Vision → conferma il POI nella foto e rileva la prospettiva
2. Recupera immagine DALL-E già cachata per quel POI + epoca (generata dall'Agente Supporto Timeline)
3. Frontend Canvas → overlay con cursore dissolve presente → passato
4. Foto risultante salvabile con watermark "Play The City" → condivisione organica

### 4b. "Foto col Monumento" — Souvenir AI

**Input:** Selfie con monumento visibile + POI attivo
**Output:** Utente inserito nella scena storica ricostruita

**Flusso:**
1. Claude Vision → identifica posizione e dimensioni del soggetto umano
2. SAM (Segment Anything) → segmentazione precisa soggetto/sfondo
3. Claude → genera prompt DALL-E per sfondo storico coerente (prospettiva, luce, spazio per il soggetto)
4. DALL-E 3 → sfondo storico fotorealistico
5. Canvas API → compositing: soggetto ritagliato + sfondo storico
6. Salvata nel profilo come "Ricordo di conquista" del POI

| Modalità | Pipeline | Latenza |
|----------|----------|---------|
| "Come era" | Vision + cache | ~2–3 sec |
| "Foto col Monumento" | Vision + SAM + Claude + DALL-E | ~8–12 sec |

---

## Agente 5 — Quiz Agent (da casa)

**Modello:** Claude API
**Trigger:** Tre contesti di attivazione
**Input:** POI target + profilo utente + storico domande già poste
**Output:** Set di domande calibrate + feedback narrativo

### Tre contesti

**A — Raccolta Pezzi (pre-conquista)**
Da casa, il giocatore vuole accumulare i 3 pezzi di un POI per pre-reclamarlo.
Claude genera domande specifiche su quel POI. Risposta corretta → pezzo guadagnato. Difficoltà media: non troppo facile (perde valore) non impossibile (frustrante).

**B — GeoGuessr del Posto**
Claude seleziona un dettaglio visivo del POI (una foto di un frammento architettonico, un'iscrizione, un angolo poco noto) e chiede: *"In quale quartiere di Roma si trova questo dettaglio?"*. L'utente sceglie tra 4 opzioni. Più difficile del quiz normale → più monete.

**C — Difesa Territorio (settimanale)**
Il giocatore deve difendere un POI già conquistato. Claude genera domande progressivamente più difficili in base al `tier` del territorio:
- **Tier 1** (stabile, prima settimana): domande base, Wikipedia-level
- **Tier 2** (a rischio, seconda settimana): dettagli meno noti
- **Tier 3** (contendibile, terza+ settimana): domande da esperto, solo chi conosce davvero il posto risponde

Claude tiene traccia delle domande già poste sullo stesso POI allo stesso utente → non ripete mai.

### Sessione Quiz Multiplayer (da casa)
Lobby pubblica o privata (codice stanza, 2–8 giocatori). Claude riceve i profili aggregati e genera un set bilanciato: difficoltà media del gruppo, mix di categorie, domande con risposta verificabile e fonte citata (Verified Source Layer). Supabase Realtime sincronizza countdown e punteggi. Al termine: monete proporzionali al punteggio.

---

## Agenti di Supporto

### Timeline Image Agent
**Modello:** Claude → DALL-E 3
**Trigger:** Prima apertura di una scheda POI (lazy, asincrono)
Claude genera 3–4 prompt storici precisi per il POI → DALL-E 3 produce le immagini → cachate in Supabase Storage. Richiesta successiva serve dalla cache. Le immagini alimentano sia la UI timeline che l'Agente 4 Vision.

### Profile Inference Agent
**Modello:** Claude
**Trigger:** Quiz iniziale di onboarding + batch ogni 10 swipe (Tinder dei posti)
Interpreta le risposte narrative del quiz e i like/dislike dei luoghi → produce e aggiorna il profilo strutturato `{interests[], cultural_level, pace, style}`. Per i gruppi: interseca i profili → itinerario bilanciato per tutti.

### Territory Agent (logica, non AI)
Calcola il decay settimanale delle proprietà, aggiorna i tier, notifica il giocatore quando un territorio è a rischio. Non usa AI — è logica pura su Supabase con cron job settimanale.

---

## Flusso completo — esempio reale

```
Utente: "Vado a Roma 3 giorni, mi piace la storia, budget medio, solo a piedi"
          │
          ▼
[AGENTE 1] OSM + Wikipedia → 60 POI grezzi
           Claude rankizza: Colosseo (9.2), Pantheon (8.8), Trastevere (8.5)...
           Filtra per budget medio, esclude posti cari senza valore narrativo
           Output: 25 POI candidati con score + stima costo + durata
          │
          ▼
[AGENTE 2] Claude distribuisce su 3 giorni, ritmo medio (10 posti/giorno)
           OSRM calcola percorsi a piedi tra ogni tappa
           Output: itinerario giornaliero con orari + "Dal Pantheon a piazza Navona:
           4 min a piedi, giri a sinistra dopo la fontana"
          │
          ▼ (utente è in città, cammina)
[AGENTE 3 — Proximity] GPS: utente a 40m dal Pantheon
           Banner: "Sei vicino al Pantheon — vuoi sapere di più?" [5s countdown]
           Silenzio → auto-accept → Claude genera narrazione proximity →
           ElevenLabs → audio in auricolare: "Non guardare ancora in su.
           Prima ascolta: quello che stai per vedere ha un buco nel tetto
           che non è mai stato riparato in 2000 anni. Ecco perché..."
          │
[AGENTE 3 — Radar] 200m più avanti, fuori itinerario: piccola chiesa medievale
           Claude valuta: relevance alta per profilo "storia" → propone
           "C'è qualcosa di strano in quella chiesa sul lato destro..."
          │
          ▼ (all'uscita dal Pantheon)
[AGENTE 4 — "Come era"] Utente fotografa il Pantheon
           Claude Vision: "Confermato, prospettiva frontale"
           Cache: immagine DALL-E anno 125 d.C. → overlay sul canvas
           Cursore: oggi ↔ 125 d.C.
          │
          ▼ (la sera, a casa)
[AGENTE 5] Utente vuole il Colosseo per domani
           3 quiz sul Colosseo → 3 pezzi guadagnati → pre-reclamo attivo
           Domani, GPS al Colosseo → conquista confermata → territorio suo per 7 giorni
```

---

## Tabella riepilogativa

| Agente | Modello/i | Quando | Output |
|--------|-----------|--------|--------|
| 1 — POI Generator | Claude + OSM + Wikipedia | Scelta città | Lista POI ranked + budget |
| 2 — Itinerary | Claude + OSRM | Conferma viaggio | Piano giornaliero + navigazione |
| 3 — Audio Guide | Claude + ElevenLabs | On-demand / GPS proximity / Radar | Audio stream narrativo |
| 4 — Vision AR | Claude Vision + DALL-E + SAM | Fotocamera aperta | Overlay storico / Souvenir composito |
| 5 — Quiz | Claude | Da casa (pezzi / difesa / multiplayer) | Domande adattive + monete |
| Support: Timeline | Claude + DALL-E 3 | Prima apertura tappa | Immagini storiche cachate |
| Support: Profile | Claude | Onboarding + swipe batch | Profilo strutturato aggiornato |
| Support: Territory | Logica Supabase | Cron settimanale | Decay tier + notifiche |
