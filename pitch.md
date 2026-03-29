# Pitch Deck — Play The City
### HackNation 2026 · Team Sigma · Challenge: Play The City (Gunpowder)

---

## Slide 01 — Cover

**Titolo:** Play The City

**Tagline:** Vivi la città da player, non da turista.

**Sottotitolo:**
Un engine di AI generativa che trasforma qualsiasi città italiana in un'esperienza di esplorazione ludica personalizzata — quiz, storie, sfide e mappa interattiva costruiti su misura per ogni giocatore.

**Challenge:** Play The City — proposta da Gunpowder

---

## Slide 02 — Il Problema (dal contesto della challenge)

**Titolo:** Il 71% della Gen Z vuole scoprire posti sorprendenti. Le guide gliene mostrano sempre gli stessi.

**Il problema è strutturale, non di contenuto:**

- **Stesso percorso per tutti** — Colosseo, Trevi, Pantheon. Stessa sequenza, stessa descrizione, indipendentemente da chi sei e cosa ti interessa.

- **Nessuna adattività** — Un bambino di 10 anni e uno storico dell'arte ricevono esattamente le stesse informazioni. Nessuna app adatta difficoltà, tono e contenuto al profilo del visitatore.

- **Passività totale** — Leggere una targa non è un'esperienza. Il turista resta spettatore, mai protagonista. Nessun quiz, nessuna sfida, nessuna storia da vivere.

- **Il patrimonio minore è invisibile** — 8.000 comuni italiani con storia, arte e cultura non hanno strumenti digitali che li rendano esplorabili e coinvolgenti.

**Fonte:** 71% Gen Z e 75% Millennials vogliono scoprire posti nuovi e sorprendenti *(dato citato nel brief della challenge)*

---

## Slide 03 — La Nostra Risposta alla Challenge

**Titolo:** Abbiamo costruito esattamente i 5 moduli richiesti.

La challenge chiedeva un engine AI capace di:

| Richiesto dalla challenge | Cosa abbiamo costruito |
|---|---|
| AI City Generator | `city.py` — OSM + Wikipedia + Wikidata → POI bilanciati per profilo |
| Verified Content Layer | Ogni contenuto cita la fonte (OSM, Wikipedia, Wikidata). Nessun contenuto "inventato" senza base dati. |
| Dynamic Quiz Engine | `quiz.py` — Claude genera quiz contestuali adattativi per ogni POI e ogni profilo |
| Narrative Mode | `audio.py` — micro-storie narrate da ElevenLabs, tono adattato all'età e al livello culturale |
| Personalization Engine | `game.py` — filtra POI e difficoltà per interessi, livello, lingua, swipe history |

**In più:** board di gioco digitale stile percorso a tappe, mappa interattiva, AR fotocamera, linea temporale storica con immagini AI.

---

## Slide 04 — Come Funziona (Architettura del Loop)

**Titolo:** Da "inserisci una città" a "il tuo percorso unico" in meno di 60 secondi.

```
[Input]
  Nome città + Profilo giocatore
  (età, interessi, lingua, livello culturale)
         ↓
[AI City Generator]
  OSM + Wikipedia + Wikidata
  → 50-100 POI candidati per la città
         ↓
[Personalization Engine]
  Filtra per profilo: arte, food, natura, storia, nightlife
  Per gruppi: intersezione interessi → tappe che soddisfano tutti
         ↓
[Game Board Generator]
  8-10 tappe ordinate come percorso di gioco
  Con itinerario pratico: trasporti, orari, tempi stimati
         ↓
[Claude AI Engine — per ogni tappa]
  • Quiz adattativo (3 livelli difficoltà)
  • Micro-storia contestuale (prompt → ElevenLabs voce)
  • Curiosità nascosta
  • Immagine storica (prompt → DALL-E 3)
         ↓
[Output]
  Board di gioco digitale personalizzato
  Funzionante in italiano, inglese, francese, spagnolo
```

---

## Slide 05 — I 5 Moduli nel Dettaglio

**Titolo:** Cinque engine, un'unica esperienza.

---

**1. AI City Generator**
Dato il nome di una città, interroga OpenStreetMap (Overpass API) e Wikidata per estrarre POI classificati per categoria: monumenti, musei, luoghi storici, food, natura, posti instagrammabili. Claude bilancia il set finale in base al profilo: un appassionato di storia riceve più siti archeologici, un foodie più mercati e ristoranti storici. Funziona per qualsiasi comune italiano, anche sotto i 500 abitanti.

**2. Verified Content Layer**
Ogni contenuto generato cita la sua origine: *"Fonte: Wikipedia IT, Wikidata Q12345, OSM node 98765"*. Claude non inventa fatti: li rielabora da fonti verificabili. Le coordinate GPS vengono da OSM. Le date storiche da Wikidata. Dove Wikipedia è scarna, il sistema lo dichiara esplicitamente.

**3. Dynamic Quiz Engine**
Claude genera quiz a scelta multipla con 3 livelli di difficoltà (casual, appassionato, esperto) calibrati sul profilo del giocatore. Le domande cambiano ad ogni sessione — non esistono due quiz uguali sullo stesso posto. Le domande errate generano una spiegazione, non solo la risposta corretta.

**4. Narrative Mode**
Per ogni tappa, Claude genera una micro-storia di 60-90 secondi che contestualizza il luogo nel suo periodo storico più significativo. Il tono è adattato: semplice e coinvolgente per i casual, denso e preciso per gli esperti. ElevenLabs la converte in voce — il giocatore ascolta mentre cammina, senza guardare lo schermo.

**5. Personalization Engine**
Il profilo si costruisce in tre passaggi: quiz onboarding gamificato (60 sec), swipe sui luoghi (Tinder dei posti), e storia di gioco accumulata. Il motore interseca le preferenze per i gruppi: se uno del gruppo ama l'arte e l'altro il food, il board include entrambe le categorie in proporzione.

---

## Slide 06 — Il Prototipo: Cosa Funziona

**Titolo:** Demo live — quello che vedrete girare oggi.

**Funzionante al 100%:**

✅ **Onboarding quiz** — 60 secondi, 2 profili diversi generano board diverse (dimostrabile live)
✅ **AI City Generator** — inserisci "Roma" → 8 tappe selezionate e bilanciate in <60 secondi
✅ **Quiz Engine** — domande generate da Claude in real time, difficoltà adattiva al profilo
✅ **Narrative Mode** — micro-storia narrata da ElevenLabs per ogni tappa
✅ **Timeline storica** — immagini DALL-E 3 per ogni era del luogo (es. Foro Romano nel 100 d.C.)
✅ **"Scatta e Scopri"** — fotocamera → Claude Vision riconosce il luogo → risponde con contenuto
✅ **Mappa interattiva** — nebbia di guerra, POI colorati al completamento
✅ **Multilanguage** — italiano e inglese funzionanti, struttura pronta per FR/ES
✅ **Classifica live** — Supabase Realtime

**Mockato per la demo (dichiarato esplicitamente):**
⚠️ GPS fisico — sostituito con posizione fissa per la demo
⚠️ Decay settimanale — UI presente, cron job non attivo
⚠️ Matchmaking sessione aperta — racconto il loop, non live

---

## Slide 07 — Qualità Tecnica dell'Implementazione

**Titolo:** Architettura production-ready, non solo hackathon.

**Stack scelto per solidità e scalabilità:**

| Layer | Tecnologia | Perché |
|---|---|---|
| Frontend | Next.js 15 + React 19 | PWA — funziona su mobile senza App Store, aggiornabile istantaneamente |
| UI/UX | TailwindCSS + Framer Motion | Mobile-first, game-feel, animazioni nebbia |
| Mappa | Leaflet.js | Open-source, nessun costo API, layer canvas per nebbia di guerra |
| Backend | FastAPI (Python) | Asincrono, perfetto per chiamate AI parallele, type-safe con Pydantic |
| Database | Supabase (PostgreSQL) | Auth + Realtime + storage in un solo servizio managed |
| AI engine | Claude API | Migliore per testo lungo, ragionamento culturale, multilanguage |
| Immagini | DALL-E 3 | Qualità fotografica per ricostruzioni storiche |
| Voce | ElevenLabs | TTS più naturale disponibile, streaming diretto nel browser |
| Dati | OSM + Wikidata + Wikipedia | Open data, nessun vincolo legale, copertura globale |

**Scelte architetturali notevoli:**
- Le immagini DALL-E vengono **cachate permanentemente** in DB dopo la prima generazione → costo marginale zero alla seconda visualizzazione
- I prompt Claude sono **separati dalla logica** di business (`app/services/ai.py`) → modificabili senza toccare il backend
- Auth completamente delegata a **Supabase** → zero codice custom, zero vulnerabilità JWT scritte a mano
- I contenuti AI vengono **validati strutturalmente** con Pydantic prima di raggiungere il frontend

---

## Slide 08 — Privacy, Bias e Trasparenza

**Titolo:** Tre principi non negoziabili nel design del sistema.

---

### Privacy

**Dati raccolti:** profilo interessi (non dati sensibili), posizione GPS solo durante la sessione di gioco attiva (non tracciamento continuo), swipe history anonimizzata.

**Dati NON raccolti:** nessuna foto conservata sul server — le immagini scattate con "Scatta e Scopri" vengono processate da Claude Vision e immediatamente scartate, non salvate. Il giocatore può eliminare il proprio profilo e tutti i dati associati in un click (GDPR compliant by design).

**Auth:** gestita interamente da Supabase con OAuth Google opzionale — nessuna password salvata in chiaro, nessun token gestito manualmente.

---

### Bias

**Il rischio:** un AI generativa che costruisce la "storia" di una città può amplificare narrazioni dominanti, ignorare minoranze, o presentare un solo punto di vista come "la verità storica".

**Come lo gestiamo:**

- **Fonti multiple e citate:** Claude non genera storia da zero — rielabora dati da Wikipedia, Wikidata, OSM. Le fonti sono mostrate all'utente. Se una fonte ha un punto di vista, il giocatore lo può verificare.
- **Prompt con istruzione anti-bias esplicita:** i system prompt chiedono a Claude di presentare fatti storici senza giudizi di valore, citare controversie storiche quando esistono, e distinguere tra fatto verificato e interpretazione.
- **Diversità dei POI:** il City Generator è istruito a includere non solo i "grandi monumenti" ma anche luoghi legati a minoranze, storie di quartiere, patrimonio immateriale — non solo la storia del potere.
- **Nessun ranking implicito:** la selezione dei POI è bilanciata per categoria, non per "importanza" — evita che l'algoritmo riproduca la gerarchia del turismo di massa.

---

### Trasparenza

**Contenuto AI:** ogni micro-storia e ogni quiz ha un tag visibile "Generato da AI · Fonte: Wikipedia/Wikidata". Il giocatore sa sempre cosa è stato creato da un modello e cosa viene da una fonte umana.

**Errori dichiarati:** se il sistema non trova dati sufficienti per un luogo, lo dice esplicitamente invece di inventare. *"Informazioni limitate disponibili per questo luogo — contenuto parziale."*

**Livello di confidenza:** per i borghi minori dove Wikidata è scarno, il contenuto generato viene marcato con un badge "Contenuto sintetico da dati strutturati" — distinto dal contenuto derivato da Wikipedia editoriale.

---

## Slide 09 — Impatto Sociale

**Titolo:** Un motore per il territorio, non solo per il turista.

**Il problema del turismo di massa:**
Roma, Venezia, Firenze soffocano. Il 99% dei flussi turistici si concentra sull'1% del patrimonio. 7.900 comuni hanno cultura, storia e bellezza — ma nessuno strumento digitale che li renda esplorabili e coinvolgenti.

**Come Play The City redistribuisce i flussi:**
Il meccanismo del territorio con decay settimanale non è un dark pattern. È un incentivo di gioco: se il tuo borgo ha già un "Guardiano", devi andarci per contenderlo. Il giocatore va a Spello, a Civita di Bagnoregio, a Matera fuori stagione — non perché lo ha letto su TripAdvisor, ma perché il gioco lo porta lì con una motivazione interna.

**Benefici misurabili:**
- **Per i visitatori:** esperienza personalizzata, apprendimento attivo, scoperta di luoghi fuori dai circuiti standard
- **Per i comuni:** flussi di visitatori tracciabili, engagement con il patrimonio locale, promozione organica zero-costo
- **Per il patrimonio minore:** ogni borgo con meno di 500 abitanti diventa un'avventura esclusiva — anzi di più, perché nessuno lo conosce già e il territorio è tutto da conquistare
- **Per l'educazione:** il quiz adattivo è uno strumento di apprendimento informale — statistiche di risposta corretta per luogo sono dati preziosi su cosa la gente sa (e non sa) del patrimonio italiano

**Alignment con politiche pubbliche:**
Il PNRR ha stanziato fondi per la valorizzazione digitale del patrimonio culturale. Play The City è esattamente quella valorizzazione — misurabile, scalabile, non autoreferenziale.

---

## Slide 10 — Coerenza con la Challenge

**Titolo:** Output richiesto vs output consegnato.

| Output richiesto dalla challenge | Presente nel prototipo |
|---|---|
| Selezionare e organizzare i luoghi più significativi tramite fonti attendibili | ✅ OSM + Wikipedia + Wikidata, fonti citate |
| Generare dinamicamente quiz, curiosità, sfide e micro-storie | ✅ Claude API, generazione real time |
| Adattare contenuti e difficoltà al profilo del giocatore | ✅ Personalization Engine su età, interessi, livello, lingua |
| Prototipo di gioco digitale (percorso a tappe) | ✅ Board con mappa, tappe, meccaniche di conquista |
| Funzionare in più lingue | ✅ Italiano, inglese — struttura pronta per FR/ES |
| AI City Generator | ✅ `city.py` |
| Verified Content Layer | ✅ Fonti mostrate, badge AI/umano |
| Dynamic Quiz Engine | ✅ `quiz.py` |
| Narrative Mode | ✅ `audio.py` + ElevenLabs |
| Personalization Engine | ✅ `game.py` |

**In più rispetto alla challenge:** AR storica, linea temporale DALL-E, territorio con decay, classifica globale, modalità gruppo con Realtime.

---

## Slide 11 — Team

**Titolo:** Team Sigma

*(Inserire nomi, foto, ruoli)*

**[Nome] — Product & AI Design**
Ha progettato il loop di gioco e i prompt Claude. Responsabile della Personalization Engine e del flusso onboarding.

**[Nome] — Frontend**
Next.js 15, Leaflet con nebbia di guerra, componenti AR, UI mobile-first, animazioni Framer Motion.

**[Nome] — Backend & AI Engine**
FastAPI, integrazione Claude + DALL-E 3 + ElevenLabs, logica territorio, coin economy, routers API.

**[Nome] — Data & Infrastructure**
Schema Supabase, pipeline OSM + Wikidata, viste materializzate per classifiche Realtime.

---

## Slide 12 — Chiusura

**Titolo grande:** Play The City

**Tagline:** Vivi la città da player, non da turista.

---

*Il turismo di massa è finito. La Gen Z non vuole la guida — vuole giocare, conquistare, difendere.*

*Play The City non usa l'AI per generare testo: la usa per costruire connessioni nascoste tra luoghi, persone e storia. La città non è lo sfondo — è il personaggio principale.*

*Quel borgo ignorato che nessuno visita? Ora ha un Guardiano. E il Guardiano ci torna.*

---

**Team Sigma — HackNation 2026**
**Challenge: Play The City (Gunpowder)**

Stack: `Next.js 15` · `FastAPI` · `Supabase` · `Claude API` · `DALL-E 3` · `ElevenLabs` · `Leaflet.js` · `OSM` · `Wikidata`

**Demo:** [inserire URL]
**GitHub:** [inserire repo]
