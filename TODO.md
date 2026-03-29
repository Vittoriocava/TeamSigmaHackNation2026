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

### C1 — Pagina città per viaggi attivi
- [ ] Navbar bottom nella pagina città
- [x] Mappa con itinerario per giorno
- [x] Posti da scoprire + posti conquistati (mappa che si scopre camminando)
- [ ] Nella mappa i POI sembrano apperire già scoperti in alcuni casi
- [ ] A volte gli account nuovi hanno già degli itinerari

### C3 — Posti di interesse su mappa in base a profilo
- [ ] Nella mappa, oltre ai posti conquistati, mostrare POI piccoli basati sul profilo utente

### C5 — Conquista territorio + quiz a 4 livelli di difficoltà
- [x] Conquista posto se hai i pezzi 
- [x] Per confermare il possesso bisogna essere sul posto fisicamente
- [x] Possesso dura 1 mese
- [x] Ogni settimana si abbassa di 1 livello la difficoltà delle domande (4 livelli)
- [x] Al livello 1 le domande sono molto facili
- [x] Per rubare un posto: completare tutte le domande del livello attuale
- [x] Se hai già fatto le domande da casa e hai i pezzi: conquista immediata
- [x] **Non ripetere stesse domande** — salvare quelle già usate nel DB
- [ ]   Bisogna fixare questo errore per il testing manuale con i click del gps:
  120 |     const handleMapClick = (e: L.LeafletMouseEvent) => {
  121 |       setCurrentPos([e.latlng.lat, e.latlng.lng]);
> 122 |       setUserPositionStore({ lat: e.latlng.lat, lng: e.latlng.lng });
      |       ^
  123 |     };
  124 |
  125 |     if (allowClickMovement) {

### C6 — "Indietro nel tempo" contenuto reale
- [ ] Integrazione agente Vision AI per generare foto del passato
- [ ] Rimuovere contenuto placeholder nella tab

### C7 — Sfida settimanale della città (foto recognition)
- [ ] Ogni settimana cambia il luogo da trovare
- [ ] Utente scatta foto → agente AI verifica se è corretto
- [ ] I primi che trovano il luogo guadagnano più XP
