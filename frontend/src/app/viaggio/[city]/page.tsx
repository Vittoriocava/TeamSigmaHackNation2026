"use client";

import { useStore, SavedItinerary, ItineraryStop, ItineraryDay } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen, Camera, ChevronDown, ChevronLeft, ChevronRight,
  Clock, HelpCircle, Link2, MapPin, Moon, Navigation,
  Play, Shield, Trophy, Utensils,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { MapPOI } from "@/components/Map/GameMap";
import { PoiQuizModal } from "@/components/Quiz/PoiQuizModal";
import { apiGet } from "@/lib/api";
import { BottomNav } from "@/components/UI/BottomNav";

const GameMap = dynamic(
  () => import("@/components/Map/GameMap").then((m) => m.GameMap),
  { ssr: false, loading: () => <div className="w-full h-48 bg-gray-800 rounded-2xl animate-pulse" /> }
);

const TRANSPORT_EMOJI: Record<string, string> = {
  piedi: "🚶", bus: "🚌", metro: "🚇", taxi: "🚕", bici: "🚲", tram: "🚋",
};

const BUDGET_LABEL: Record<string, string> = {
  economico: "€", medio: "€€", comfort: "€€€", lusso: "€€€€",
};

const STOP_ICONS: Record<string, typeof BookOpen> = {
  story: BookOpen, quiz: HelpCircle, curiosity: HelpCircle,
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

interface TerritoryInfo {
  poi_id: string;
  user_id: string;
  tier: number;
  weeks_held: number;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ViaggioPage() {
  const params = useParams();
  const city = decodeURIComponent(params.city as string);
  const router = useRouter();
  const { currentGame, savedItineraries, token, user, profile, completeStop } = useStore();

  const isActive = currentGame?.city === city;
  const savedItinerary = savedItineraries.find((s) => s.city === city);

  const [territories, setTerritories] = useState<TerritoryInfo[]>([]);
  const [defending, setDefending] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState(0);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [profilePois, setProfilePois] = useState<MapPOI[]>([]);

  useEffect(() => {
    const slug = city.toLowerCase().replace(/ /g, "-").replace(/'/g, "");
    fetch(`/api/territory/city/${slug}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((d) => setTerritories(d.territories ?? []))
      .catch(() => {});
  }, [city, token]);

  // Fetch profile-based POI suggestions
  useEffect(() => {
    if (!profile?.interests?.length) return;
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${API}/api/city/${encodeURIComponent(city)}/profile-pois?interests=${profile.interests.join(",")}`)
      .then((r) => r.json())
      .then((d) => {
        const existing = new Set((currentGame?.stops || []).map((s) => s.poi.id));
        const suggestions: MapPOI[] = (d.pois || []).filter(
          (p: { id: string; lat: number; lng: number }) => !existing.has(p.id) && p.lat && p.lng
        ).map((p: { id: string; name: string; lat: number; lng: number }) => ({
          id: p.id,
          name: p.name,
          lat: p.lat,
          lng: p.lng,
          status: "poi-suggestion" as const,
        }));
        setProfilePois(suggestions);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, profile?.interests]);

  const handleDefend = async (poiId: string) => {
    if (!token) return;
    setDefending(poiId);
    try {
      await fetch(`/api/territory/defend?poi_id=${poiId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* ignore */ } finally {
      setDefending(null);
    }
  };

  // ── empty state ─────────────────────────────────────────────────────────────
  if (!isActive && !savedItinerary) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-4 text-center">
        <span className="text-4xl">🗺️</span>
        <h2 className="font-display text-xl font-bold">{city}</h2>
        <p className="text-white/50 text-sm">Nessun viaggio pianificato per questa città.</p>
        <button
          onClick={() => router.push(`/pianifica/${encodeURIComponent(city)}`)}
          className="bg-primary text-white rounded-2xl px-6 py-3 text-sm font-semibold"
        >
          Pianifica un viaggio a {city}
        </button>
        <button onClick={() => router.push("/")} className="text-white/30 text-xs">
          ← Torna indietro
        </button>
      </div>
    );
  }

  // ── FUTURE TRIP ─────────────────────────────────────────────────────────────
  if (!isActive && savedItinerary) {
    return (
      <FutureTripView
        city={city}
        savedItinerary={savedItinerary}
        territories={territories}
        token={token}
        userId={user?.id}
        onBack={() => router.push("/")}
        onStartAdventure={() =>
          router.push(`/board/new?city=${encodeURIComponent(city)}&mode=solo`)
        }
        onPoiClick={(poiId) => router.push(`/tappa/${poiId}`)}
        activeDay={activeDay}
        setActiveDay={setActiveDay}
      />
    );
  }

  // ── ACTIVE TRIP ─────────────────────────────────────────────────────────────
  const game = currentGame!;
  const currentStopIdx = game.currentStopIndex;
  const currentStop = game.stops[currentStopIdx];

  const mapPois: MapPOI[] = [
    ...game.stops.map((s, i) => ({
      id: s.poi.id,
      name: s.poi.name,
      lat: s.poi.lat,
      lng: s.poi.lng,
      status: (s.completed ? "conquered" : i === currentStopIdx ? "current" : "fog") as MapPOI["status"],
      type: s.type,
    })),
    ...profilePois,
  ];

  const completedCount = game.stops.filter((s) => s.completed).length;
  const StopIcon = currentStop ? (STOP_ICONS[currentStop.type] ?? MapPin) : MapPin;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="px-4 pt-12 pb-3 sticky top-0 z-20 bg-black/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="glass rounded-full p-2 flex-shrink-0">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg font-bold truncate">{city}</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium flex-shrink-0">
                In corso
              </span>
            </div>
            <p className="text-[11px] text-white/40">
              {completedCount}/{game.stops.length} tappe · {game.score} pt
            </p>
          </div>
          <div className="flex items-center gap-1.5 glass rounded-full px-3 py-1.5">
            <Trophy size={13} className="text-primary-light" />
            <span className="text-xs font-bold">{game.score * 5}</span>
          </div>
        </div>
      </header>

      {/* Map */}
      <section className="px-4 mb-4">
        <motion.div
          animate={{ height: mapExpanded ? 320 : 160 }}
          transition={{ duration: 0.3 }}
          className="relative overflow-hidden rounded-2xl"
        >
          <GameMap
            pois={mapPois}
            center={currentStop ? [currentStop.poi.lat, currentStop.poi.lng] : [41.9, 12.49]}
            zoom={14}
            onPoiClick={(poi) => router.push(`/tappa/${poi.id}`)}
          />
          <button
            onClick={() => setMapExpanded((v) => !v)}
            className="absolute bottom-2 right-2 glass rounded-full p-1.5 z-[1000]"
          >
            {mapExpanded ? <ChevronLeft size={14} className="rotate-90" /> : <ChevronDown size={14} />}
          </button>
        </motion.div>
      </section>

      {/* Progress bar */}
      <div className="px-4 mb-5">
        <div className="flex gap-1">
          {game.stops.map((s, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                s.completed ? "bg-green-500" : i === currentStopIdx ? "bg-primary animate-pulse" : "bg-white/10"
              }`}
            />
          ))}
        </div>
        <p className="text-[10px] text-white/30 mt-1">
          Tappa {currentStopIdx + 1} di {game.stops.length}
        </p>
      </div>

      <div className="px-4 space-y-3">
        {/* Current stop card */}
        {currentStop && (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStopIdx}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2 }}
              className="glass rounded-2xl overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${STOP_COLORS[currentStop.type] ?? "bg-white/10 text-white/50"}`}>
                    <StopIcon size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-medium uppercase text-white/40">
                        {currentStop.type}
                      </span>
                      {currentStop.poi.hidden_gem && (
                        <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                          Hidden Gem
                        </span>
                      )}
                    </div>
                    <h2 className="font-display text-lg font-bold leading-tight">
                      {currentStop.poi.name}
                    </h2>
                    <p className="text-xs text-white/40 mt-0.5">{currentStop.poi.category}</p>
                  </div>
                </div>

                {(currentStop.poi.why_for_you || currentStop.poi.description) && (
                  <p className="text-sm text-white/70 leading-relaxed mb-4">
                    {currentStop.poi.why_for_you || currentStop.poi.description}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/tappa/${currentStop.poi.id}`)}
                    className="flex-1 glass py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <BookOpen size={13} /> Apri tappa
                  </button>
                  {!currentStop.completed && (
                    <button
                      onClick={() => completeStop(currentStopIdx)}
                      className="flex-1 bg-primary/80 text-white py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      ✓ Segna come visitato
                    </button>
                  )}
                  {currentStop.completed && (
                    <div className="flex-1 bg-green-500/20 text-green-400 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5">
                      ✓ Completata
                    </div>
                  )}
                </div>

                {/* Conquista territory */}
                {currentStop.completed && (
                  <div className="mt-2">
                    {territories.some((t) => t.poi_id === currentStop.poi.id && t.user_id === user?.id) ? (
                      <button
                        onClick={() => handleDefend(currentStop.poi.id)}
                        disabled={defending === currentStop.poi.id}
                        className="w-full flex items-center justify-center gap-1.5 bg-blue-500/20 text-blue-400 rounded-xl py-2 text-xs font-semibold"
                      >
                        <Shield size={12} /> {defending === currentStop.poi.id ? "..." : "Difendi territorio"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDefend(currentStop.poi.id)}
                        disabled={defending === currentStop.poi.id}
                        className="w-full flex items-center justify-center gap-1.5 bg-yellow-500/20 text-yellow-400 rounded-xl py-2 text-xs font-semibold"
                      >
                        <Shield size={12} /> {defending === currentStop.poi.id ? "..." : "Conquista territorio"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* All stops mini list */}
        <div className="space-y-1.5">
          {game.stops.map((s, i) => {
            if (i === currentStopIdx) return null;
            const Icon = STOP_ICONS[s.type] ?? MapPin;
            return (
              <button
                key={i}
                onClick={() => router.push(`/tappa/${s.poi.id}`)}
                className={`w-full glass rounded-xl p-3 flex items-center gap-3 text-left ${s.completed ? "opacity-50" : ""}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${STOP_COLORS[s.type] ?? "bg-white/10 text-white/30"}`}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.poi.name}</p>
                  <p className="text-[10px] text-white/40">{s.type}</p>
                </div>
                {s.completed && <span className="text-green-400 text-xs flex-shrink-0">✓</span>}
                {i === currentStopIdx + 1 && !s.completed && (
                  <span className="text-[10px] text-primary-light flex-shrink-0">Prossima →</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom nav */}
      <BottomNav />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FUTURE TRIP VIEW
// ─────────────────────────────────────────────────────────────────────────────

function FutureTripView({
  city,
  savedItinerary,
  territories,
  token,
  userId,
  onBack,
  onStartAdventure,
  onPoiClick,
  activeDay,
  setActiveDay,
}: {
  city: string;
  savedItinerary: SavedItinerary;
  territories: TerritoryInfo[];
  token: string | null;
  userId?: string;
  onBack: () => void;
  onStartAdventure: () => void;
  onPoiClick: (poiId: string) => void;
  activeDay: number;
  setActiveDay: (n: number) => void;
}) {
  const days = savedItinerary.itinerary;
  const currentDay = days[activeDay];

  // Pieces state: map of poi_id → pieces_collected
  const [piecesMap, setPiecesMap] = useState<Record<string, number>>({});
  const [quizPoi, setQuizPoi] = useState<{ id: string; name: string; description?: string } | null>(null);

  // Load user pieces on mount
  useEffect(() => {
    if (!userId) return;
    apiGet<{ pieces: { poi_id: string; pieces_collected: number }[] }>(
      `/api/itineraries/pieces/user/${userId}`,
      token ?? undefined,
    )
      .then((d) => {
        const map: Record<string, number> = {};
        d.pieces.forEach((p) => { map[p.poi_id] = p.pieces_collected; });
        setPiecesMap(map);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const mapPois: MapPOI[] = (savedItinerary.pois ?? [])
    .filter((p) => p.lat !== 0 && p.lng !== 0)
    .map((p) => {
      const pieces = piecesMap[p.id] ?? 0;
      const inCurrentDay = currentDay?.stops.some((s) => s.poi_id === p.id);
      return {
        id: p.id,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        status: pieces >= 3 ? "conquered" : inCurrentDay ? "current" : "fog",
      };
    });

  const firstDayPoi = mapPois.find((p) =>
    currentDay?.stops.some((s) => s.poi_id === p.id)
  );
  const mapCenter: [number, number] = firstDayPoi
    ? [firstDayPoi.lat, firstDayPoi.lng]
    : [41.9, 12.49];

  const [focusedPoi, setFocusedPoi] = useState<string | null>(null);

  return (
    <>
    {/* Quiz modal */}
    <AnimatePresence>
      {quizPoi && (
        <PoiQuizModal
          poiId={quizPoi.id}
          poiName={quizPoi.name}
          poiDescription={quizPoi.description}
          city={city}
          token={token}
          onClose={(result) => {
            if (result?.pieces_total !== undefined) {
              setPiecesMap((prev) => ({ ...prev, [quizPoi.id]: result.pieces_total }));
            }
            setQuizPoi(null);
          }}
        />
      )}
    </AnimatePresence>

    <div className="min-h-screen pb-40">
      {/* Header */}
      <header className="px-4 pt-12 pb-3 sticky top-0 z-20 bg-black/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="glass rounded-full p-2 flex-shrink-0">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg font-bold truncate">{city}</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium flex-shrink-0">
                Futuro
              </span>
            </div>
            <p className="text-[11px] text-white/40">
              {savedItinerary.startDate
                ? formatDate(savedItinerary.startDate) + " · "
                : ""}
              {savedItinerary.days} {savedItinerary.days === 1 ? "giorno" : "giorni"} ·{" "}
              {savedItinerary.likedPoisCount} posti ·{" "}
              {BUDGET_LABEL[savedItinerary.tripProfile?.budget ?? "medio"] ?? "€€"}
            </p>
          </div>
        </div>
      </header>

      {/* Map */}
      {mapPois.length > 0 && (
        <div className="px-4 mb-4">
          <div className="h-48 rounded-2xl overflow-hidden">
            <GameMap
              pois={mapPois}
              center={mapCenter}
              zoom={13}
              onPoiClick={(poi) => {
                setFocusedPoi(poi.id);
                document.getElementById(`stop-${poi.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            />
          </div>
          <p className="text-[10px] text-white/30 text-center mt-1">
            Tocca un marker per evidenziare la tappa
          </p>
        </div>
      )}

      {/* Day tabs */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {days.map((day, i) => (
            <button
              key={i}
              onClick={() => { setActiveDay(i); setFocusedPoi(null); }}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeDay === i ? "bg-primary text-white" : "glass text-white/60"
              }`}
            >
              Giorno {day.day}
            </button>
          ))}
        </div>
      </div>

      {/* Day content */}
      <AnimatePresence mode="wait">
        {currentDay && (
          <motion.div
            key={activeDay}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18 }}
            className="px-4"
          >
            {/* Day header */}
            <div className="glass rounded-2xl px-4 py-3 mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Tema</p>
                <p className="font-display font-bold text-sm">{currentDay.theme}</p>
              </div>
              <span className="text-sm text-white/60 font-semibold">
                {currentDay.total_cost_estimate}
              </span>
            </div>

            {/* Stops */}
            <div className="space-y-0 mb-4">
              {currentDay.stops.map((stop, idx) => {
                const isFocused = focusedPoi === stop.poi_id;
                const isLast = idx === currentDay.stops.length - 1;
                return (
                  <div key={`${idx}-${stop.poi_id}`} id={`stop-${stop.poi_id}`} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        isFocused ? "border-primary bg-primary text-white" : "border-white/20 bg-white/5 text-white/50"
                      }`}>
                        <span className="text-xs font-bold">{idx + 1}</span>
                      </div>
                      {!isLast && <div className="w-0.5 flex-1 bg-white/10 my-1 min-h-[12px]" />}
                    </div>

                    <div className={`flex-1 pb-3 transition-all ${isFocused ? "scale-[1.01]" : ""}`}>
                      <div className={`glass rounded-2xl p-4 border ${isFocused ? "border-primary/40" : "border-transparent"}`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <button
                            onClick={() => onPoiClick(stop.poi_id)}
                            className="font-semibold text-sm text-left hover:text-primary-light transition-colors"
                          >
                            {stop.poi_name}
                          </button>
                          <span className="text-[10px] text-white/40 flex items-center gap-1 flex-shrink-0">
                            <Clock size={9} /> {stop.arrival_time}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3 text-[11px] text-white/40">
                          <span className="flex items-center gap-1">
                            <Clock size={9} /> {stop.duration_min} min
                          </span>
                          {stop.transport && (
                            <span>{TRANSPORT_EMOJI[stop.transport.toLowerCase()] ?? "🚗"} {stop.transport}</span>
                          )}
                          {stop.distance_from_prev && (
                            <span className="flex items-center gap-1">
                              <MapPin size={9} /> {stop.distance_from_prev}
                            </span>
                          )}
                        </div>

                        {stop.tips && (
                          <div className="bg-white/5 rounded-xl px-3 py-2 mb-3">
                            <p className="text-[11px] text-white/60 flex items-start gap-1.5">
                              <Navigation size={10} className="text-primary-light mt-0.5 flex-shrink-0" />
                              {stop.tips}
                            </p>
                          </div>
                        )}

                        {/* Pieces + Quiz */}
                        {(() => {
                          const pieces = piecesMap[stop.poi_id] ?? 0;
                          return (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-white/30">Pezzi:</span>
                                <div className="flex gap-1">
                                  {[0, 1, 2].map((i) => (
                                    <div
                                      key={i}
                                      className={`w-4 h-4 rounded-sm border flex items-center justify-center text-[9px] ${
                                        i < pieces
                                          ? "border-primary bg-primary/30 text-primary-light"
                                          : "border-white/20 bg-white/5"
                                      }`}
                                    >
                                      {i < pieces ? "🧩" : ""}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {pieces < 3 ? (
                                <button
                                  onClick={() => setQuizPoi({ id: stop.poi_id, name: stop.poi_name })}
                                  className="flex items-center gap-1.5 bg-primary/20 text-primary-light rounded-xl px-3 py-1.5 text-xs font-semibold"
                                >
                                  <HelpCircle size={13} /> Fai il quiz
                                </button>
                              ) : (
                                <span className="text-[11px] text-primary-light font-semibold">
                                  ✓ Completo!
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Meals */}
            {(currentDay.lunch_suggestion || currentDay.dinner_suggestion) && (
              <div className="flex gap-2 mb-4">
                {currentDay.lunch_suggestion && (
                  <div className="glass rounded-2xl p-3 flex items-center gap-2 flex-1">
                    <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                      <Utensils size={14} className="text-orange-300" />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/40">Pranzo</p>
                      <p className="text-xs font-medium leading-tight">{currentDay.lunch_suggestion}</p>
                    </div>
                  </div>
                )}
                {currentDay.dinner_suggestion && (
                  <div className="glass rounded-2xl p-3 flex items-center gap-2 flex-1">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Moon size={14} className="text-blue-300" />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/40">Cena</p>
                      <p className="text-xs font-medium leading-tight">{currentDay.dinner_suggestion}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Day nav */}
            <div className="flex gap-2 mb-4">
              {activeDay > 0 && (
                <button
                  onClick={() => setActiveDay(activeDay - 1)}
                  className="flex-1 glass py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
                >
                  <ChevronLeft size={14} /> Giorno {activeDay}
                </button>
              )}
              {activeDay < days.length - 1 && (
                <button
                  onClick={() => setActiveDay(activeDay + 1)}
                  className="flex-1 glass py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
                >
                  Giorno {activeDay + 2} <ChevronRight size={14} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-8 pt-3 bg-gradient-to-t from-black/90 to-transparent z-20">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onStartAdventure}
          className="w-full py-4 rounded-2xl font-bold bg-primary text-white flex items-center justify-center gap-2"
        >
          <Play size={18} /> Inizia l&apos;avventura a {city}
        </motion.button>
        <p className="text-center text-[10px] text-white/25 mt-1.5">
          Modalità gioco attivata · GPS + AR + Quiz
        </p>
      </div>
    {/* Bottom nav */}
    <BottomNav />
    </div>
    </>
  );
}
