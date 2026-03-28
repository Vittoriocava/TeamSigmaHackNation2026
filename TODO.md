Le notifiche non fanno nulla, le toglierei
Scopri ora non fa nulla, è hardcoded, rendi interattivo
Giocatori attivi non serve
I tuoi interessi sono hardcoded, deve profilare veramente
La classifica è reale?
Se ci sono altre cose hardcoded, è da renderle reali

- [ ] togliere navbar da altre pagine
- [ ] manca la pagina della città per i viaggi attivi:
    - [ ] rimmettere navbar (bottom)
    - [ ] mappa, itinerario per giorno, posti da scoprire, posti conquistati (mappa che si scopre quando passeggio)
    - [ ] in questa mappa  oltre posti conquistati anche posti piccoli di nostro interesse in base a profilo

    - [ ] audioguida dei posti (elevenlabs) in cui apri posto e te lo racconta.

pagina del posto:
- [ ] se posto conquistato possiamo decidere di mostrare una frase o qualcosa di tuo per personalizzarlo
- [ ] se è un posto conquistato da altri, vedi la frase e puoi mettere like o saluto
- [ ] se saluti o vieni salutato prendi punti
- [ ] se è un posto non conquistato lo puoi conquistare se hai i pezzi. il possesso dura 1 mese, poi ogni settimana che passa si abbasssa di livello le domande dei quiz, per rubare un posto devi fare tutte le domande, altrimenti lo prendi subito se hai fatto le domande a casa e hai i pezzi. 4 livelli di domande e ogni settimana che passa si abbassa di livello la difficoltà del livello, al livello 1 le domande sono molto facili. NON DEVONO RICAPITARE STESSE DOMANDE, quindi devi salvare quelle già usate)
- [ ] altra tab con indietro nel tempo tramite agente e foto, da rimuovere "come era nella tab AR".

pagina nella citta:
- [ ] fai sfida del luogo da trovare, ogni settimana cambia, devi fare foto a questo luogo e agente ai dice se è corretto o no, controllato da agente, e questo ti dà XP i primi che la trovano fanno più XP.


itinerario dopo la scelta:
- [ ] no ripetere posti dopo la scelta


altro
fixare bottoni in basso troppo larghi come pc 
- [ ] tasto per la fine della scelta il tasto indietro deve portarti alla home
## Error Type
Console Error

## Error Message
Encountered two children with the same key, `Venezia-futuro`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.


    at HomePage (src/app/page.tsx:207:13)

## Code Frame
  205 |         ) : (
  206 |           <div className="space-y-3">
> 207 |             <AnimatePresence>
      |             ^
  208 |               {viaggi.map((v, i) => (
  209 |                 <motion.button
  210 |                   key={`${v.city}-${v.status}`}

Next.js version: 15.5.14 (Webpack)

- [ ] dentro la tappa in pezzi se sono stati conquistati non li mostra, deve mostrarli (http://localhost:3000/tappa/ai_b9cd16bb20), il quiz dve partire anche da lì e togli geogussr
