# AI_AGENT.md — Come e dove viene usata l'AI in Play The City

L'AI non è una feature aggiuntiva. È il motore centrale dell'app: senza AI non esiste personalizzazione, non esistono contenuti, non esiste gioco. Ogni interazione significativa passa attraverso uno o più modelli.

---

## Mappa degli agenti AI

```
                        ┌─────────────────────┐
                        │   PROFILO UTENTE    │
                        │  (interessi, livello │
                        │   lingua, swipe)     │
                        └──────────┬──────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
    ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
    │  CITY GENERATOR  │  │ PERSONALIZATION  │  │  QUIZ INFERENCE  │
    │  Claude + OSM +  │  │    AGENT         │  │  AGENT           │
    │  Wikipedia →     │  │  Claude filtra   │  │  Claude deduce   │
    │  lista POI       │  │  POI per profilo │  │  profilo dal     │
    └────────┬─────────┘  └────────┬─────────┘  │  quiz iniziale   │
             │                     │            └──────────────────┘
             └──────────┬──────────┘
                        ▼
              ┌──────────────────────┐
              │   CONTENT AGENT      │  ← Claude: generazione
              │   Per ogni tappa:    │    contenuto principale
              │   - quiz adattivo    │
              │   - micro-storia     │
              │   - curiosità        │
              │   - filo narrativo   │
              └──────┬───────┬───────┘
                     │       │
          ┌──────────┘       └──────────┐
          ▼                             ▼
 ┌─────────────────┐         ┌─────────────────────┐
 │  VOICE AGENT    │         │  TIMELINE AGENT     │
 │  ElevenLabs:    │         │  Claude genera       │
 │  testo → voce  │         │  prompt storico →    │
 │  adattiva al   │         │  DALL-E 3 genera     │
 │  profilo       │         │  immagine dell'epoca │
 └─────────────────┘         └─────────────────────┘

 ┌─────────────────────────────────────────────────┐
 │  VISION AGENT  (Modalità Campo)                 │
 │  Claude Vision analizza foto scattata           │
 │  → conferma sfida / genera commento contestuale │
 └─────────────────────────────────────────────────┘
```

---

## Agente 1 — Profile Inference Agent

**Modello:** Claude API
**Trigger:** Onboarding (quiz iniziale) + sessioni di swipe Tinder dei posti
**Input:** Risposte al quiz (scelte narrative, non form) + like/dislike su card POI
**Output:** Profilo strutturato `{interests[], cultural_level, pace, style}`

### Come funziona
Il quiz iniziale non è un form con checkbox. L'utente risponde a domande del tipo:
*"Sei a Roma per un pomeriggio. Scegli: Colosseo o Trastevere?"*
*"Preferisci capire la storia di un posto o assaggiare il cibo locale?"*

Claude riceve le 10 risposte e le interpreta in linguaggio naturale → produce un profilo semantico. Non regole if/else — comprensione del significato delle scelte.

Con il tempo, lo swipe dei posti (Tinder-style) aggiorna il profilo: ogni like/dislike viene mandato a Claude con il profilo attuale → Claude aggiorna i pesi degli interessi.

**Per i gruppi:** Claude riceve i profili di tutti i membri → identifica l'intersezione degli interessi → suggerisce tappe che soddisfano tutti, con note su chi apprezzerà cosa.

```python
# Prompt semplificato
"""
Profilo attuale: {profile_json}
Nuovi swipe: {swipes_list}  # [{poi: "Mercato di Testaccio", liked: true}, ...]
Aggiorna il profilo e spiega brevemente cosa è cambiato.
Rispondi in JSON: {interests, cultural_level, preferred_pace, style_tags}
"""
```

---

## Agente 2 — City Generator Agent

**Modello:** Claude API + Overpass API (OSM) + Wikipedia REST + Wikidata
**Trigger:** L'utente sceglie una città (o borgo)
**Input:** Nome città, profilo utente, livello giocatore
**Output:** Lista di 20–30 POI candidati con metadati e fonti

### Come funziona
1. **Overpass API** → fetch di tutti i POI della città classificati (monumenti, musei, mercati, chiese, botteghe, parchi, locali)
2. **Wikipedia/Wikidata** → per ogni POI, recupera descrizione, date storiche, coordinate, immagini
3. **Claude** → riceve la lista grezza e la raffina:
   - Scarta i POI troppo simili tra loro
   - Bilancia le categorie (non solo musei)
   - Per borghi piccoli dove Wikipedia è scarna: genera il contenuto dai dati Wikidata strutturati
   - Assegna a ogni POI un "valore narrativo" in base al profilo utente
   - Aggiunge tag: `{category, narrative_value, difficulty, hidden_gem: bool}`

**Caso speciale borghi:** Se Wikipedia non ha articolo per il comune, Claude usa i dati Wikidata (fondazione, popolazione, monumenti censiti, coordinate) per costruire il contenuto da zero. Nessun borgo rimane senza storia.

---

## Agente 3 — Personalization Agent

**Modello:** Claude API
**Trigger:** Post City Generator, pre-costruzione board
**Input:** Lista POI candidati + profilo utente + livello giocatore + swipe history
**Output:** Selezione ordinata di 10–15 POI per la partita + motivazione per ognuno

### Come funziona
Claude riceve la lista e il profilo e seleziona le tappe ottimali:
- Priorità a POI con alto `narrative_value` per quel profilo
- Livello giocatore basso → esclude POI nascosti di livello avanzato
- Swipe history → esclude categorie sistematicamente rifiutate
- Vincolo di bilanciamento: almeno 1 tappa per categoria principale
- Per gruppi: trova il sottoinsieme che massimizza la soddisfazione di tutti i profili

L'output include anche una **"scintilla narrativa"** — una frase che Claude usa per costruire il filo della partita (lo "Spirito del Luogo").

---

## Agente 4 — Content Agent

**Modello:** Claude API
**Trigger:** Per ogni tappa della board al momento della generazione
**Input:** POI (nome, dati Wikipedia/Wikidata), profilo utente, filo narrativo della partita, tappa precedente
**Output:** Contenuto completo della tappa

### Cosa genera per ogni tappa

**Quiz adattivo (3 domande, difficoltà progressiva)**
```
Facile:   "In che anno fu costruito il Pantheon?"  → scelta multipla
Medio:    "Quale imperatore commissionò il Pantheon attuale?"
Difficile: "Perché il Pantheon è rimasto intatto mentre altri monumenti romani no?"
```
La difficoltà si calibra sul livello culturale del profilo e sulla performance nelle tappe precedenti della stessa sessione.

**Micro-storia contestuale (200–300 parole)**
Non la scheda Wikipedia. Una storia in prima persona, un aneddoto, un dettaglio umano. Tono e registro adattati al profilo: bambino → narrazione semplice e visiva; esperto → dettagli storici densi.

**Curiosità nascosta**
Un fatto sorprendente che la maggior parte dei turisti non conosce. *"Il Pantheon affonda di 2,5 cm ogni secolo ma non è mai stato restaurato perché..."*

**Connessione narrativa**
Claude collega la tappa corrente alla precedente attraverso il filo dello "Spirito del Luogo". L'utente sente che sta vivendo una storia coerente, non una lista di posti.

**Prompt per ElevenLabs**
Claude riscrive la micro-storia nel registro vocale appropriato (diverso da quello scritto) e indica il tono emotivo al sintetizzatore.

**Prompt per DALL-E (linea temporale)**
Per ogni tappa, Claude genera 3–4 prompt storici precisi:
```
"Il Pantheon di Roma nel 125 d.C., fotorealistico, costruzione appena completata,
marmi bianchi lucidi, romani in toga nella piazza antistante, cielo azzurro,
prospettiva frontale grandangolare"
```

---

## Agente 5 — Voice Agent

**Modello:** ElevenLabs API
**Trigger:** Ogni volta che una micro-storia o curiosità viene mostrata
**Input:** Testo generato da Claude + parametri tono (dal profilo)
**Output:** Audio stream MP3

### Come funziona
- Claude ha già preparato il testo nel registro vocale corretto
- ElevenLabs riceve il testo + `voice_id` scelto in base al profilo e alla città
- La risposta è uno stream audio diretto → riprodotto nel browser con `<audio>` senza buffering
- In Modalità Campo: parte automaticamente all'arrivo sulla tappa, l'utente cammina e ascolta

**Voci per città (esempio):**
- Roma → voce maschile profonda, ritmo lento, tono solenne
- Napoli → voce calda, cadenza vivace
- Profilo bambino → voce femminile dolce, ritmo lento, parole semplici

---

## Agente 6 — Timeline Image Agent

**Modello:** Claude API → DALL-E 3 (OpenAI)
**Trigger:** Apertura della scheda tappa (lazy load)
**Input:** Nome POI + dati storici Wikipedia/Wikidata
**Output:** 3–4 immagini del luogo in epoche diverse, cachate in DB

### Come funziona
**Step 1 — Claude genera i prompt storici:**
Riceve i dati del luogo e produce un prompt DALL-E preciso per ogni epoca significativa. Include contesto visivo (abbigliamento, vegetazione, stato del monumento, luce), prospettiva, stile realistico.

**Step 2 — DALL-E 3 genera le immagini:**
Ogni prompt → immagine 1024×1024. Le immagini vengono salvate in Supabase Storage con chiave `{poi_id}_{era}`.

**Cache:** Le immagini si generano una sola volta. Le richieste successive per lo stesso POI+epoca servono dal DB. Riduce costi e latenza drasticamente.

---

## Agente 7 — Vision Agent (due modalità)

**Modello:** Claude Vision API + DALL-E 3
**Trigger:** Utente apre la fotocamera su una tappa in Modalità Campo
**Due esperienze distinte:**

---

### 7a. "Come era" — Viaggio nel Tempo

**Input:** Foto scattata dall'utente (edificio/piazza/monumento) + POI attivo
**Output:** Overlay composito: foto reale + immagine storica sovrapposta

**Flusso:**
1. Claude Vision riceve la foto e conferma il POI ripreso (*"Sì, è il Pantheon, prospettiva frontale"*)
2. Recupera dal cache Supabase l'immagine DALL-E già generata per l'epoca selezionata
3. Il frontend compone l'overlay: immagine storica semi-trasparente sovrapposta alla foto reale
4. Cursore di dissoluzione presente → passato controllabile dall'utente
5. Foto salvabile e condivisibile con watermark "Play The City" → promozione organica

```python
# Step 1 — Claude Vision identifica il POI e la prospettiva
"""
Foto allegata. Il giocatore si trova al POI: {poi_name}.
Conferma che il soggetto principale della foto è questo luogo.
Indica la prospettiva (frontale, laterale, dall'alto) per allineare
correttamente l'overlay storico.
Rispondi: {confirmed: bool, perspective: str, notes: str}
"""

# Step 2 — compositing frontend (no AI, solo CSS/Canvas)
# overlay DALL-E image con opacity variabile sul canvas della foto scattata
```

---

### 7b. "Foto col Monumento" — Souvenir AI

**Input:** Selfie o foto con il monumento visibile + POI attivo + profilo utente
**Output:** Foto composita: utente nella scena storica ricostruita da DALL-E

**Flusso:**
1. Claude Vision segmenta il soggetto umano dalla foto (separa persona da sfondo)
2. Claude genera un prompt DALL-E specifico per la composizione: luogo nell'epoca scelta, con spazio per inserire il soggetto, prospettiva coerente con la foto originale
3. DALL-E 3 genera lo sfondo storico
4. Frontend compone: soggetto ritagliato (da Vision) + sfondo storico (da DALL-E)
5. Risultato: il giocatore è fisicamente dentro la scena storica (es: davanti al Colosseo integro, anno 80 d.C.)
6. Salvata nel profilo come "Ricordo di conquista" del POI — visibile nella pagina proprietà

```python
# Step 1 — Claude Vision: segmentazione soggetto
"""
Foto allegata. Identifica e descrivi la posizione del soggetto umano
(in piedi, centrato, sfondo occupato da X%).
Rispondi: {subject_position: str, background_coverage: float,
           suggested_crop: {x,y,w,h}}
"""

# Step 2 — Claude: genera prompt DALL-E per sfondo storico coerente
"""
POI: {poi_name}. Epoca: {era}.
Il soggetto è in piedi al centro, sfondo deve occupare 70% dell'immagine.
Prospettiva: leggermente rialzata, grandangolo.
Genera un prompt DALL-E 3 per lo sfondo storico fotorealistico,
senza persone in primo piano (spazio riservato al soggetto).
"""

# Step 3 — DALL-E 3: genera sfondo storico
# Step 4 — frontend Canvas API: compositing soggetto + sfondo
```

**Nota tecnica:** la segmentazione precisa del soggetto richiede un modello dedicato (es. SAM — Segment Anything Model di Meta, disponibile via Replicate API) per risultati ottimali. Per il MVP si può usare una maschera approssimata da Claude Vision con rifinimento canvas.

| Modalità Vision | Modelli coinvolti | Latenza stimata |
|----------------|------------------|-----------------|
| "Come era" | Claude Vision + cache DALL-E | ~2–3 sec |
| "Foto col Monumento" | Claude Vision + Claude + DALL-E 3 (+ SAM) | ~8–12 sec |

---

## Agente 8 — Quiz Session Agent (Multiplayer)

**Modello:** Claude API
**Trigger:** Host crea una sessione quiz online
**Input:** Città scelta + profili aggregati dei partecipanti
**Output:** Set di 10–20 domande bilanciate per il gruppo

### Come funziona
Claude riceve i profili di tutti i partecipanti e genera domande:
- Difficoltà media tra tutti i livelli presenti
- Varietà di categorie (non solo storia)
- Domande con una risposta chiara e verificabile (no ambiguità)
- Fonte inclusa in ogni domanda (Wikipedia/Wikidata) per il Verified Source Layer

Le domande vengono generate prima dell'inizio della sessione e servite in sequenza. Supabase Realtime sincronizza i countdown e i punteggi tra tutti i client.

---

## Agente 9 — Territory Quiz Agent

**Modello:** Claude API
**Trigger:** Giocatore vuole difendere il territorio di un POI da casa
**Input:** POI specifico + livello difficoltà attuale (tier 1/2/3) + storico risposte precedenti
**Output:** Quiz di difesa (3 domande, più difficili man mano che il territorio invecchia)

### Come funziona
Il quiz di difesa è diverso da quello di scoperta. È più specifico, più profondo, progressivamente più difficile:
- **Tier 1** (difesa normale): domande di livello base sul POI
- **Tier 2** (territorio a rischio): domande su dettagli meno noti
- **Tier 3** (contendibile): domande che solo un vero esperto del luogo conoscerebbe

Claude tiene conto delle domande già poste nelle sessioni precedenti → non ripete mai la stessa domanda allo stesso utente sullo stesso POI.

---

## Agente 10 — Itinerary Agent

**Modello:** Claude API + OSM routing
**Trigger:** Conferma del viaggio (prima di partire)
**Input:** Lista tappe ordinate + modalità spostamento + orari disponibili
**Output:** Itinerario pratico con tempi, percorso, note logistiche

### Come funziona
Claude riceve le tappe selezionate e produce:
- Ordine ottimale di visita (minimizza spostamenti, rispetta orari apertura)
- Stima tempi realistici (visita + spostamento)
- Note contestuali: *"Arrivi al mercato alle 11 — è il momento migliore, il pomeriggio è più affollato"*
- Alternative se un posto è chiuso

---

## Flusso dati AI completo (esempio: utente arriva a Roma)

```
1. [PROFILE INFERENCE] Claude legge quiz + swipe → profilo: {food, storia moderna, casual, IT}

2. [CITY GENERATOR] OSM → 80 POI Roma. Wikipedia → metadati.
   Claude → seleziona 25 POI bilanciati, scarta duplicati, valorizza hidden gems

3. [PERSONALIZATION] Claude → 12 tappe finali per questo profilo.
   Spirito del luogo: "Roma è una città che mangia la storia a colazione"

4. [CONTENT] Per ogni tappa, Claude genera:
   → quiz (3 diff.) + storia (tono casual + food angle) + curiosità + connessione

5. [VOICE] ElevenLabs → audio stream della storia, voce Roma-solenne

6. [TIMELINE] Claude → 4 prompt DALL-E per "Mercato di Testaccio"
   DALL-E 3 → immagini 1800, 1930, 1970, oggi → salvate in cache

7. [GPS] Utente arriva al Mercato → sblocco fisico → tappa colorata

8. [VISION] Sfida: "Fotografa la scritta in ferro battuto sull'ingresso"
   Claude Vision → conferma + "Quella scritta fu aggiunta nel 1921 quando..."

9. [TERRITORY] Conquista! Quiz di difesa generato per la settimana prossima

10. [ITINERARY] Claude → prossima tappa ottimale, percorso a piedi 8 minuti
```

---

## Costi e ottimizzazioni

| Agente | Modello | Quando | Ottimizzazione |
|--------|---------|--------|----------------|
| Profile Inference | Claude | Onboarding + ogni swipe batch | Batch swipe ogni 10 swipe, non realtime |
| City Generator | Claude | Una volta per città | Cache per città popolari (Roma, Milano) |
| Content Agent | Claude | Generazione board | Pre-generazione asincrona mentre l'utente è in viaggio |
| Voice Agent | ElevenLabs | On-demand per tappa | Cache audio per testo identico |
| Timeline Images | DALL-E 3 | Prima apertura tappa | Cache permanente in Supabase Storage |
| Vision Agent | Claude Vision | Solo sfide foto | Nessuna cache — ogni foto è unica |
| Quiz Multiplayer | Claude | Inizio sessione | Generazione batch pre-sessione |
| Territory Quiz | Claude | Difesa settimanale | Pool di domande pre-generate per POI popolari |

**Regola generale:** tutto ciò che può essere pre-generato o cachato, lo è. L'unica AI chiamata in tempo reale obbligatoria è Claude Vision (foto uniche) e il Profile Update (swipe batch).
