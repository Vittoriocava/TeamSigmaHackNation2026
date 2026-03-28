"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  BookOpen, HelpCircle, Eye, Link2, Camera, MapPin,
  ChevronDown, ChevronUp, Trophy, Coins, Volume2,
} from "lucide-react";
import { Button } from "@/components/UI/Button";
import { Card } from "@/components/UI/Card";
import { BottomNav } from "@/components/UI/BottomNav";
import type { MapPOI } from "@/components/Map/GameMap";

// Dynamic import for Leaflet (SSR incompatible)
const GameMap = dynamic(
  () => import("@/components/Map/GameMap").then((m) => m.GameMap),
  { ssr: false, loading: () => <div className="w-full h-64 bg-gray-800 rounded-2xl animate-pulse" /> }
);

const STOP_ICONS: Record<string, typeof BookOpen> = {
  story: BookOpen,
  quiz: HelpCircle,
  curiosity: Eye,
  connection: Link2,
  ar: Camera,
  challenge: MapPin,
  geoguessr: MapPin,
};

const STOP_COLORS: Record<string, string> = {
  story: "bg-blue-500/20 text-blue-400",
  quiz: "bg-yellow-500/20 text-yellow-400",
  curiosity: "bg-purple-500/20 text-purple-400",
  connection: "bg-pink-500/20 text-pink-400",
  ar: "bg-green-500/20 text-green-400",
  challenge: "bg-red-500/20 text-red-400",
  geoguessr: "bg-orange-500/20 text-orange-400",
};

// Mock game data for demo
const MOCK_GAME = {
  id: "demo-roma",
  city: "Roma",
  city_slug: "roma",
  mode: "solo",
  stops: [
    { poi: { id: "1", name: "Colosseo", lat: 41.8902, lng: 12.4922, category: "storia", description: "L'anfiteatro Flavio, simbolo di Roma.", relevance_score: 9.5, estimated_cost: "€€", estimated_duration: 90, hidden_gem: false, why_for_you: "Imperdibile per chi ama la storia" }, type: "story", content: { story: "Non guardare ancora in su. Prima ascolta: quello che stai per vedere ha ospitato 50.000 spettatori. I gladiatori entravano dal sottosuolo, attraverso un sistema di montacarichi che ancora oggi stupisce gli ingegneri. Il Colosseo non è un rudere — è una macchina teatrale perfetta." }, completed: false },
    { poi: { id: "2", name: "Foro Romano", lat: 41.8925, lng: 12.4853, category: "storia", description: "Il centro della vita pubblica dell'antica Roma.", relevance_score: 9.0, estimated_cost: "€€", estimated_duration: 60, hidden_gem: false, why_for_you: "Il cuore politico dell'impero" }, type: "quiz", content: { quiz: { question: "Quale imperatore fece costruire l'Arco di Tito nel Foro Romano?", options: ["Domiziano", "Nerone", "Augusto", "Traiano"], correct_index: 0, explanation: "L'Arco di Tito fu completato dall'imperatore Domiziano nell'82 d.C." } }, completed: false },
    { poi: { id: "3", name: "Pantheon", lat: 41.8986, lng: 12.4769, category: "storia", description: "Il tempio di tutti gli dei.", relevance_score: 9.2, estimated_cost: "gratuito", estimated_duration: 45, hidden_gem: false, why_for_you: "Architettura che sfida i millenni" }, type: "curiosity", content: { curiosity: "L'oculus del Pantheon, il buco nel soffitto, non ha vetro. Quando piove, l'acqua entra davvero. Ma il pavimento ha un sistema di drenaggio romano ancora funzionante dopo 2000 anni che la raccoglie e la porta via. Il 95% dei visitatori non lo nota." }, completed: false },
    { poi: { id: "4", name: "Piazza Navona", lat: 41.8992, lng: 12.4731, category: "arte", description: "La piazza barocca più famosa di Roma.", relevance_score: 8.5, estimated_cost: "gratuito", estimated_duration: 30, hidden_gem: false, why_for_you: "Bernini vs Borromini: la rivalità nell'arte" }, type: "connection", content: { connection: "Dal Pantheon a Piazza Navona: 4 minuti a piedi che attraversano 1500 anni. Il Pantheon era il tempio degli dei pagani, la piazza era lo stadio di Domiziano. Entrambi furono reinventati dal Barocco. Bernini e Borromini si sfidarono proprio qui, a colpi di fontane." }, completed: false },
    { poi: { id: "5", name: "Quartiere Coppedè", lat: 41.9147, lng: 12.5089, category: "architettura", description: "Quartiere Art Nouveau nascosto.", relevance_score: 8.8, estimated_cost: "gratuito", estimated_duration: 30, hidden_gem: true, why_for_you: "Gemma nascosta: architettura surreale" }, type: "ar", content: { instruction: "Inquadra l'arco d'ingresso del Quartiere Coppedè per sbloccare la sfida AR" }, completed: false },
    { poi: { id: "6", name: "Trastevere", lat: 41.8869, lng: 12.4699, category: "nightlife", description: "Il quartiere bohémien di Roma.", relevance_score: 8.3, estimated_cost: "€", estimated_duration: 60, hidden_gem: false, why_for_you: "Vita notturna autentica" }, type: "challenge", content: { instruction: "Trova una bottega storica in Trastevere e scattale una foto" }, completed: false },
    { poi: { id: "7", name: "Mercato di Testaccio", lat: 41.8763, lng: 12.4750, category: "food", description: "Il mercato dei romani.", relevance_score: 8.7, estimated_cost: "€", estimated_duration: 45, hidden_gem: true, why_for_you: "Street food autentico" }, type: "geoguessr", content: { instruction: "Indovina da quale zona di Roma viene questa immagine" }, completed: false },
    { poi: { id: "8", name: "Giardino degli Aranci", lat: 41.8836, lng: 12.4796, category: "natura", description: "Vista panoramica su Roma dall'Aventino.", relevance_score: 8.6, estimated_cost: "gratuito", estimated_duration: 20, hidden_gem: true, why_for_you: "Il tramonto perfetto su Roma" }, type: "story", content: { story: "Questo giardino ha un segreto. Non guardare la vista — guarda il buco della serratura del Priorato di Malta, appena fuori dal cancello. Attraverso quella serratura vedrai una prospettiva perfetta: la cupola di San Pietro incorniciata da un corridoio di alberi. È la foto più cercata di Roma e quasi nessuno sa trovarla." }, completed: false },
  ],
};

export default function BoardPage() {
  const params = useParams();
  const router = useRouter();
  const [game] = useState(MOCK_GAME);
  const [currentStop, setCurrentStop] = useState(0);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [completedStops, setCompletedStops] = useState<Set<number>>(new Set());

  const stop = game.stops[currentStop];

  const mapPois: MapPOI[] = game.stops.map((s, i) => ({
    id: s.poi.id,
    name: s.poi.name,
    lat: s.poi.lat,
    lng: s.poi.lng,
    status: completedStops.has(i) ? "conquered" : i === currentStop ? "current" : "fog",
    type: s.type,
  }));

  const handleComplete = () => {
    setCompletedStops((prev) => new Set([...prev, currentStop]));
    setScore((s) => s + 10);
    setShowModal(false);
    setQuizAnswer(null);
    if (currentStop < game.stops.length - 1) {
      setCurrentStop(currentStop + 1);
    }
  };

  const StopIcon = STOP_ICONS[stop.type] || MapPin;

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="px-4 pt-8 pb-2 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">{game.city}</h1>
          <p className="text-xs text-white/50">
            Tappa {currentStop + 1}/{game.stops.length} · {score} punti
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="glass rounded-full px-3 py-1 flex items-center gap-1">
            <Coins size={14} className="text-yellow-400" />
            <span className="text-sm font-semibold">{score * 5}</span>
          </div>
          <div className="glass rounded-full px-3 py-1 flex items-center gap-1">
            <Trophy size={14} className="text-primary-light" />
            <span className="text-sm font-semibold">{completedStops.size}</span>
          </div>
        </div>
      </header>

      {/* Map */}
      <section className="px-4 mb-4">
        <motion.div
          animate={{ height: mapExpanded ? 350 : 180 }}
          className="relative overflow-hidden rounded-2xl"
        >
          <GameMap
            pois={mapPois}
            center={[stop.poi.lat, stop.poi.lng]}
            zoom={14}
            onPoiClick={(poi) => {
              const idx = game.stops.findIndex((s) => s.poi.id === poi.id);
              if (idx >= 0) setCurrentStop(idx);
            }}
          />
          <button
            onClick={() => setMapExpanded(!mapExpanded)}
            className="absolute bottom-2 right-2 glass rounded-full p-2 z-[1000]"
          >
            {mapExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </motion.div>
      </section>

      {/* Progress bar */}
      <div className="px-4 mb-4">
        <div className="flex gap-1">
          {game.stops.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                completedStops.has(i)
                  ? "bg-green-500"
                  : i === currentStop
                  ? "bg-primary animate-pulse-glow"
                  : "bg-white/10"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Current Stop Card */}
      <section className="px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStop}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass rounded-2xl overflow-hidden"
          >
            {/* Stop header */}
            <div className="p-4 flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${STOP_COLORS[stop.type]}`}>
                <StopIcon size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium uppercase text-white/40">
                    {stop.type}
                  </span>
                  {stop.poi.hidden_gem && (
                    <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                      Hidden Gem
                    </span>
                  )}
                </div>
                <h2 className="font-display text-lg font-bold">
                  {stop.poi.name}
                </h2>
                <p className="text-xs text-white/50 mt-1">
                  {stop.poi.why_for_you}
                </p>
              </div>
            </div>

            {/* Stop content */}
            <div className="px-4 pb-4">
              {stop.type === "story" && (
                <div>
                  <p className="text-sm text-white/80 leading-relaxed">
                    {(stop.content as { story: string }).story}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 flex items-center gap-2"
                  >
                    <Volume2 size={14} /> Ascolta narrazione
                  </Button>
                </div>
              )}

              {stop.type === "quiz" && (
                <div>
                  <p className="font-medium mb-3">
                    {(stop.content as { quiz: { question: string; options: string[]; correct_index: number; explanation: string } }).quiz.question}
                  </p>
                  <div className="space-y-2">
                    {(stop.content as { quiz: { question: string; options: string[]; correct_index: number; explanation: string } }).quiz.options.map((opt: string, i: number) => (
                      <motion.button
                        key={i}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setQuizAnswer(i)}
                        className={`w-full text-left p-3 rounded-xl text-sm transition-all ${
                          quizAnswer === null
                            ? "glass hover:bg-white/20"
                            : i === (stop.content as { quiz: { correct_index: number } }).quiz.correct_index
                            ? "bg-green-500/20 border border-green-500/40"
                            : quizAnswer === i
                            ? "bg-red-500/20 border border-red-500/40"
                            : "glass opacity-50"
                        }`}
                        disabled={quizAnswer !== null}
                      >
                        <span className="text-white/40 mr-2">
                          {String.fromCharCode(65 + i)}.
                        </span>
                        {opt}
                      </motion.button>
                    ))}
                  </div>
                  {quizAnswer !== null && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-white/60 mt-3 glass rounded-xl p-3"
                    >
                      {(stop.content as { quiz: { explanation: string } }).quiz.explanation}
                    </motion.p>
                  )}
                </div>
              )}

              {stop.type === "curiosity" && (
                <div className="glass-dark rounded-xl p-3">
                  <p className="text-sm text-white/80 italic">
                    💡 {(stop.content as { curiosity: string }).curiosity}
                  </p>
                </div>
              )}

              {stop.type === "connection" && (
                <div className="glass-dark rounded-xl p-3">
                  <p className="text-sm text-white/80">
                    🔗 {(stop.content as { connection: string }).connection}
                  </p>
                </div>
              )}

              {(stop.type === "ar" || stop.type === "challenge" || stop.type === "geoguessr") && (
                <div className="glass-dark rounded-xl p-3 flex items-center gap-3">
                  <Camera size={24} className="text-primary-light flex-shrink-0" />
                  <p className="text-sm text-white/80">
                    {(stop.content as { instruction: string }).instruction}
                  </p>
                </div>
              )}

              {/* Complete button */}
              {!completedStops.has(currentStop) && (
                <Button
                  onClick={handleComplete}
                  className="w-full mt-4"
                  disabled={stop.type === "quiz" && quizAnswer === null}
                >
                  {stop.type === "ar" || stop.type === "challenge"
                    ? "📸 Apri Fotocamera"
                    : "Completa Tappa →"}
                </Button>
              )}
              {completedStops.has(currentStop) && (
                <div className="mt-4 text-center text-green-400 text-sm font-medium">
                  ✓ Tappa completata!
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Stop list */}
        <div className="mt-4 space-y-2">
          {game.stops.map((s, i) => {
            if (i === currentStop) return null;
            const Icon = STOP_ICONS[s.type] || MapPin;
            return (
              <motion.button
                key={i}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCurrentStop(i)}
                className={`w-full glass rounded-xl p-3 flex items-center gap-3 ${
                  completedStops.has(i) ? "opacity-60" : ""
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${STOP_COLORS[s.type]}`}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{s.poi.name}</p>
                  <p className="text-[10px] text-white/40">{s.type}</p>
                </div>
                {completedStops.has(i) && (
                  <span className="text-green-400 text-xs">✓</span>
                )}
              </motion.button>
            );
          })}
        </div>
      </section>

      <div className="h-20" />
      <BottomNav />
    </div>
  );
}
