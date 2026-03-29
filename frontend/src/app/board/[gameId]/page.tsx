"use client";

import type { MapPOI } from "@/components/Map/GameMap";
import { BottomNav } from "@/components/UI/BottomNav";
import { Button } from "@/components/UI/Button";
import { apiPost } from "@/lib/api";
import { useStore } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  BookOpen,
  Camera,
  ChevronDown,
  ChevronUp,
  Coins,
  Eye,
  HelpCircle,
  Link2,
  MapPin,
  Trophy,
  Volume2,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const GameMap = dynamic(
  () => import("@/components/Map/GameMap").then((m) => m.GameMap),
  { ssr: false, loading: () => <div className="w-full h-64 bg-gray-800 rounded-2xl animate-pulse" /> }
);

const STOP_ICONS: Record<string, typeof BookOpen> = {
  story: BookOpen, quiz: HelpCircle, curiosity: Eye,
  connection: Link2, ar: Camera, challenge: MapPin, geoguessr: MapPin,
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

const LOADING_STEPS = [
  "Recupero luoghi da OpenStreetMap...",
  "Arricchisco con dati Wikipedia...",
  "L'AI analizza il tuo profilo...",
  "Genero storie e quiz personalizzati...",
  "Preparo il tabellone di gioco...",
];

interface GameData {
  id: string;
  city: string;
  city_slug?: string;
  mode: string;
  stops: Array<{
    poi: {
      id: string; name: string; lat: number; lng: number;
      category: string; description: string; relevance_score: number;
      estimated_cost: string; estimated_duration: number;
      hidden_gem: boolean; why_for_you: string;
    };
    type: string;
    content: Record<string, unknown>;
    completed: boolean;
  }>;
}

function BoardContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { profile, token, currentGame } = useStore();

  const gameId = params.gameId as string;
  const city = searchParams.get("city") || "";
  const mode = searchParams.get("mode") || "solo";

  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState("");
  const [currentStop, setCurrentStop] = useState(0);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [completedStops, setCompletedStops] = useState<Set<number>>(new Set());

  useEffect(() => {
    // If we have a local game ID (from create-demo), use the board stored in Zustand
    if (gameId.startsWith("local-")) {
      if (currentGame && currentGame.id === gameId) {
        setGame({
          id: currentGame.id,
          city: currentGame.city,
          city_slug: currentGame.citySlug,
          mode: currentGame.mode,
          stops: currentGame.stops as GameData["stops"],
        });
      } else if (currentGame) {
        // Different local ID but we have board data — use it anyway
        setGame({
          id: gameId,
          city: currentGame.city || city,
          city_slug: currentGame.citySlug,
          mode: currentGame.mode,
          stops: currentGame.stops as GameData["stops"],
        });
      } else {
        setError("Partita non trovata. Torna alla home e ricomincia.");
      }
      return;
    }

    if (gameId !== "new" || !city) return;

    const generate = async () => {
      setLoading(true);
      setLoadingStep(0);

      // Animate through loading steps
      const interval = setInterval(() => {
        setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
      }, 3000);

      try {
        const result = await apiPost<{ game_id: string | null; board: GameData }>(
          "/api/game/create",
          {
            city,
            mode,
            duration_days: 1,
            budget: "medio",
            profile: profile
              ? {
                  user_id: "",
                  interests: profile.interests,
                  age_range: profile.ageRange,
                  cultural_level: profile.culturalLevel,
                  language: profile.language,
                  pace: profile.pace,
                }
              : {},
          },
          token || undefined,
          90000 // 90s timeout — AI generation can take a while
        );
        setGame(result.board);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Errore nella generazione del gioco");
      } finally {
        clearInterval(interval);
        setLoading(false);
      }
    };

    generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, city, mode, profile, token, currentGame]);

  const handleComplete = () => {
    setCompletedStops((prev) => new Set([...prev, currentStop]));
    setScore((s) => s + 10);
    setQuizAnswer(null);
    if (game && currentStop < game.stops.length - 1) {
      setCurrentStop(currentStop + 1);
    }
  };

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="font-display text-xl font-bold mb-2">
            Creo il tuo viaggio a {city}
          </h2>
          <AnimatePresence mode="wait">
            <motion.p
              key={loadingStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-white/50 text-sm"
            >
              {LOADING_STEPS[loadingStep]}
            </motion.p>
          </AnimatePresence>
          <div className="flex gap-1 justify-center mt-6">
            {LOADING_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-500 ${
                  i <= loadingStep ? "w-6 bg-primary" : "w-2 bg-white/20"
                }`}
              />
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // Error screen
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <AlertCircle size={48} className="text-red-400 mb-4" />
        <h2 className="font-display text-lg font-bold mb-2">Ops, qualcosa è andato storto</h2>
        <p className="text-white/50 text-sm text-center mb-6">{error}</p>
        <Button onClick={() => router.push("/")}>Torna alla home</Button>
      </div>
    );
  }

  if (!game) return null;

  const stop = game.stops[currentStop];
  const StopIcon = STOP_ICONS[stop.type] || MapPin;

  const mapPois: MapPOI[] = game.stops.map((s, i) => ({
    id: s.poi.id,
    name: s.poi.name,
    lat: s.poi.lat,
    lng: s.poi.lng,
    status: completedStops.has(i) ? "conquered" : i === currentStop ? "current" : "fog",
    type: s.type,
  }));

  const quiz = stop.content.quiz as { question: string; options: string[]; correct_index: number; explanation: string } | undefined;

  return (
    <div className="min-h-screen pb-20">
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
        <motion.div animate={{ height: mapExpanded ? 350 : 180 }} className="relative overflow-hidden rounded-2xl">
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
                completedStops.has(i) ? "bg-green-500" : i === currentStop ? "bg-primary animate-pulse" : "bg-white/10"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Stop Card */}
      <section className="px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStop}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass rounded-2xl overflow-hidden"
          >
            <div className="p-4 flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${STOP_COLORS[stop.type]}`}>
                <StopIcon size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium uppercase text-white/40">{stop.type}</span>
                  {stop.poi.hidden_gem && (
                    <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">Hidden Gem</span>
                  )}
                </div>
                <h2 className="font-display text-lg font-bold">{stop.poi.name}</h2>
                <p className="text-xs text-white/50 mt-1">{stop.poi.why_for_you}</p>
              </div>
            </div>

            <div className="px-4 pb-4">
              {stop.type === "story" && (
                <div>
                  <p className="text-sm text-white/80 leading-relaxed">
                    {(stop.content.story as string) || (stop.content.description as string) || stop.poi.description}
                  </p>
                  <Button variant="ghost" size="sm" className="mt-3 flex items-center gap-2">
                    <Volume2 size={14} /> Ascolta narrazione
                  </Button>
                </div>
              )}

              {stop.type === "quiz" && (
                <div>
                  {quiz ? (
                    <>
                      <p className="font-medium mb-3">{quiz.question}</p>
                      <div className="space-y-2">
                        {quiz.options.map((opt, i) => (
                          <motion.button
                            key={i}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setQuizAnswer(i)}
                            disabled={quizAnswer !== null}
                            className={`w-full text-left p-3 rounded-xl text-sm transition-all ${
                              quizAnswer === null
                                ? "glass hover:bg-white/20"
                                : i === quiz.correct_index
                                ? "bg-green-500/20 border border-green-500/40"
                                : quizAnswer === i
                                ? "bg-red-500/20 border border-red-500/40"
                                : "glass opacity-50"
                            }`}
                          >
                            <span className="text-white/40 mr-2">{String.fromCharCode(65 + i)}.</span>
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
                          {quiz.explanation}
                        </motion.p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-white/80 leading-relaxed">
                      {(stop.content.description as string) || stop.poi.description}
                    </p>
                  )}
                </div>
              )}

              {stop.type === "curiosity" && (
                <div className="glass-dark rounded-xl p-3">
                  <p className="text-sm text-white/80 italic">
                    💡 {(stop.content.curiosity as string) || (stop.content.description as string) || stop.poi.description}
                  </p>
                </div>
              )}

              {stop.type === "connection" && (
                <div className="glass-dark rounded-xl p-3">
                  <p className="text-sm text-white/80">
                    🔗 {(stop.content.connection as string) || (stop.content.description as string) || stop.poi.description}
                  </p>
                </div>
              )}

              {(stop.type === "ar" || stop.type === "challenge" || stop.type === "geoguessr") && (
                <div className="glass-dark rounded-xl p-3 flex items-center gap-3">
                  <Camera size={24} className="text-primary-light flex-shrink-0" />
                  <p className="text-sm text-white/80">
                    {(stop.content.instruction || stop.content.fallback) as string}
                  </p>
                </div>
              )}

              {!completedStops.has(currentStop) && (
                <Button
                  onClick={handleComplete}
                  className="w-full mt-4"
                  disabled={stop.type === "quiz" && quizAnswer === null}
                >
                  {stop.type === "ar" || stop.type === "challenge" ? "📸 Apri Fotocamera" : "Completa Tappa →"}
                </Button>
              )}
              {completedStops.has(currentStop) && (
                <div className="mt-4 text-center text-green-400 text-sm font-medium">✓ Tappa completata!</div>
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
                className={`w-full glass rounded-xl p-3 flex items-center gap-3 ${completedStops.has(i) ? "opacity-60" : ""}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${STOP_COLORS[s.type]}`}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{s.poi.name}</p>
                  <p className="text-[10px] text-white/40">{s.type}</p>
                </div>
                {completedStops.has(i) && <span className="text-green-400 text-xs">✓</span>}
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

export default function BoardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BoardContent />
    </Suspense>
  );
}
