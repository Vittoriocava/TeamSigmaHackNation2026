# TODO — Play The City

## ✅ Completati

- [x] Fix bottoni in basso troppo larghi su PC (max-width container)
- [x] Fix errore console chiave duplicata `Venezia-futuro`
- [x] Togliere navbar da pagine dove non serve
- [x] Interessi profilo reali (non hardcoded)
- [x] Classifica reale (fetch da API)
- [x] Territorio reale (fetch da API)
- [x] Tappa pezzi: mostrare pezzi conquistati, quiz funzionante, rimosso GeoGuessr
- [x] Tasto indietro dopo scelta itinerario → home
- [x] Fix Suspense boundary su `/board/new`
- [x] B1: "Scopri ora" — non presente nel codice, nessuna azione
- [x] B2: Notifiche — non presenti nel codice, nessuna azione
- [x] B3: Non ripetere posti nello stesso viaggio (dedup backend)
- [x] C2: Audioguida ElevenLabs — wired su tappa page
- [x] C4: Frase personalizzata + saluti/like su territori altrui
- [x] C5: Quiz a 4 livelli di difficoltà basati su tier territorio
- [x] C5: Non ripetere stesse domande quiz (hash-based)
- [x] C6: Tab "AR" rinominata in "Nel Tempo"
- [x] Store fix: ricostruito con tutti i tipi mancanti
- [x] C8: Merge del codice della mappa che si sblocca (Component GameMap con Nebbia di Guerra)

---

## 🔴 Ancora da fare

(Tutti completati! 🎉)

---

## ✅ Completati (sessione 2)

### C1 — Pagina città per viaggi attivi
- [x] Navbar bottom nella pagina città
- [x] Mappa con itinerario per giorno
- [x] Posti da scoprire + posti conquistati (mappa che si scopre camminando)
- [x] Fix POI che appaiono già scoperti nei viaggi futuri
- [x] Fix account nuovi che ereditano itinerari da sessioni precedenti

### C3 — Posti di interesse su mappa in base a profilo
- [x] Nella mappa, POI personalizzati (cyan) basati sul profilo utente — endpoint + frontend

### C5 — Fix errore setUserPositionStore
- [x] Conquista posto se hai i pezzi 
- [x] Per confermare il possesso bisogna essere sul posto fisicamente
- [x] Possesso dura 1 mese
- [x] Ogni settimana si abbassa di 1 livello la difficoltà delle domande (4 livelli)
- [x] Al livello 1 le domande sono molto facili
- [x] Per rubare un posto: completare tutte le domande del livello attuale
- [x] Se hai già fatto le domande da casa e hai i pezzi: conquista immediata
- [x] **Non ripetere stesse domande** — salvare quelle già usate nel DB
- [x] Fix setUserPositionStore: aggiunto `setUserPosition` + `userPosition` allo store Zustand

### C6 — "Indietro nel tempo" contenuto reale
- [x] Integrazione agente Vision AI per generare foto del passato (camera + /api/ai/vision/come-era)
- [x] Rimosso contenuto placeholder nella tab — ora con camera, selettore era, risultato AI

### C7 — Sfida settimanale della città (foto recognition)
- [x] Ogni settimana cambia il luogo da trovare (challenge.py + generate endpoint)
- [x] Utente scatta foto → agente AI verifica se è corretto (Vision AI + analyze_photo)
- [x] I primi che trovano il luogo guadagnano più XP (500→300→200→150→100...)
- [x] Pagina sfida completa (sfida/page.tsx) + card nella home + BottomNav aggiornata

