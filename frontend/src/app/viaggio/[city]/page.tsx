"use client";

import { useStore } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft, Clock, HelpCircle, MapPin, Puzzle,
  Shield, Utensils, Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { MapPOI } from "@/components/Map/GameMap";

const GameMap = dynamic(
  () => import("@/components/Map/GameMap").then((m) => m.GameMap),
  { ssr: false, loading: () => <div className="w-full h-56 bg-gray-800 rounded-2xl animate-pulse" /> }
);

interface TerritoryOwner {
  poi_id: string;
  user_id: string;
  tier: number;
  weeks_held: number;
}

const TRANSPORT_EMOJI: Record<string, string> = {
  piedi: "🚶", bus: "🚌", metro: "🚇", taxi: "🚕", bici: "🚲", tram: "🚋",
};

export default function ViaggioPage() {
  const params = useParams();
  const city = decodeURIComponent(params.city as string);
  const router = useRouter();
  const { currentGame, savedItineraries, token, user } = useStore();

  const [tab, setTab] = useState<"mappa" | "itinerario">("itinerario");
  const [territories, setTerritories] = useState<TerritoryOwner[]>([]);
  const [defending, setDefending] = useState<string | null>(null);

  const isActive = currentGame?.city === city;
  const savedItinerary = savedItineraries.find((s) => s.city === city);

  useEffect(() => {
    if (!isActive) return;
    const citySlug = city.toLowerCase().replace(/ /g, "-").replace(/'/g, "");
    fetch(`/api/territory/city/${citySlug}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((d) => setTerritories(d.territories || []))
      .catch(() => {});
  }, [isActive, city, token]);

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

  if (!isActive && !savedItinerary) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-4">
        <p className="text-white/60 text-sm">Nessun viaggio trovato per {city}</p>
        <button
          onClick={() => router.push(`/pianifica/${encodeURIComponent(city)}`)}
          className="text-primary text-sm font-medium"
        >
          Pianifica un viaggio a {city} →
        </button>
        <button onClick={() => router.back()} className="text-white/40 text-xs">
          Torna indietro
        </button>
      </div>
    );
  }

  // ── FUTURE TRIP ──────────────────────────────────────────────────────────
  if (!isActive && savedItinerary) {
    const allStops = savedItinerary.itinerary.flatMap((day) =>
      day.stops.map((stop) => ({ ...stop, day: day.day, theme: day.theme }))
    );

    return (
      <div className="min-h-screen pb-8">
        <header className="px-4 pt-12 pb-4">
          <button onClick={() => router.back()} className="glass rounded-full p-2 mb-4 inline-flex">
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold">{city}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">
                Viaggio futuro
              </span>
            </div>
          </div>
          <p className="text-white/50 text-sm mt-2">
            Fai i quiz per raccogliere i pezzi dei posti — poi potrai conquistarli dal vivo.
          </p>
        </header>

        <section className="px-4 space-y-3">
          {savedItinerary.itinerary.map((day) => (
            <div key={day.day}>
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                Giorno {day.day} · {day.theme}
              </h2>

              {day.stops.map((stop) => (
                <motion.div
                  key={stop.poi_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-xl p-4 mb-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-white/40">{stop.arrival_time}</span>
                        {stop.transport && (
                          <span className="text-xs text-white/30">
                            {TRANSPORT_EMOJI[stop.transport] ?? "🚶"} {stop.distance_from_prev}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm">{stop.poi_name}</h3>
                      {stop.tips && (
                        <p className="text-xs text-white/50 mt-1 line-clamp-2">{stop.tips}</p>
                      )}
                      <div className="flex items-center gap-1 mt-2">
                        <Clock size={12} className="text-white/30" />
                        <span className="text-[10px] text-white/40">{stop.duration_min} min</span>
                      </div>
                    </div>

                    {/* Pieces + Quiz */}
                    <div className="flex flex-col items-center gap-2 flex-shrink-0">
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="w-4 h-4 rounded-sm border border-white/20 bg-white/5 flex items-center justify-center"
                          >
                            <Puzzle size={8} className="text-white/20" />
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => router.push(`/quiz-live?poi=${stop.poi_id}&poi_name=${encodeURIComponent(stop.poi_name)}&city=${encodeURIComponent(city)}`)}
                        className="flex items-center gap-1 bg-primary/20 text-primary-light rounded-lg px-3 py-1.5 text-xs font-medium"
                      >
                        <HelpCircle size={12} />
                        Quiz
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Pranzo / cena */}
              <div className="flex gap-2 mb-3">
                {day.lunch_suggestion && (
                  <div className="glass rounded-xl p-2 flex items-center gap-2 flex-1">
                    <Utensils size={12} className="text-orange-400 flex-shrink-0" />
                    <p className="text-[11px] text-white/60 truncate">{day.lunch_suggestion}</p>
                  </div>
                )}
                {day.dinner_suggestion && (
                  <div className="glass rounded-xl p-2 flex items-center gap-2 flex-1">
                    <span className="text-xs flex-shrink-0">🌙</span>
                    <p className="text-[11px] text-white/60 truncate">{day.dinner_suggestion}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
      </div>
    );
  }

  // ── ACTIVE TRIP ───────────────────────────────────────────────────────────
  const game = currentGame!;
  const mapPois: MapPOI[] = game.stops.map((s, i) => ({
    id: s.poi.id,
    name: s.poi.name,
    lat: s.poi.lat,
    lng: s.poi.lng,
    status: s.completed ? "conquered" : i === game.currentStopIndex ? "current" : "fog",
    type: s.type,
  }));

  const centerPoi = game.stops[game.currentStopIndex]?.poi ?? game.stops[0]?.poi;

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <header className="px-4 pt-12 pb-3">
        <button onClick={() => router.back()} className="glass rounded-full p-2 mb-3 inline-flex">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">{city}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">
              In corso
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="glass rounded-full px-3 py-1 text-xs">
              <span className="text-primary-light font-semibold">{game.stops.filter(s => s.completed).length}</span>
              <span className="text-white/40">/{game.stops.length} tappe</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="flex gap-1 glass rounded-xl p-1">
          {[
            { key: "mappa", label: "Mappa" },
            { key: "itinerario", label: "Itinerario" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                tab === t.key ? "bg-primary text-white" : "text-white/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {tab === "mappa" && (
          <motion.div key="mappa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4">
            <div className="h-[360px] rounded-2xl overflow-hidden mb-4">
              <GameMap
                pois={mapPois}
                center={centerPoi ? [centerPoi.lat, centerPoi.lng] : [41.9, 12.49]}
                zoom={14}
                onPoiClick={(poi) => router.push(`/tappa/${poi.id}`)}
              />
            </div>

            {/* Territory legend */}
            <div className="glass rounded-xl p-3">
              <p className="text-xs font-semibold text-white/60 mb-2">Proprietà</p>
              <div className="space-y-1.5">
                {territories.length === 0 ? (
                  <p className="text-xs text-white/40">Nessun territorio conquistato in questa città</p>
                ) : (
                  territories.map((t) => {
                    const stop = game.stops.find((s) => s.poi.id === t.poi_id);
                    return (
                      <div key={t.poi_id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield size={12} className="text-blue-400" />
                          <span className="text-xs">{stop?.poi.name ?? t.poi_id}</span>
                        </div>
                        <span className="text-[10px] text-white/40">Tier {t.tier} · {t.weeks_held}w</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}

        {tab === "itinerario" && (
          <motion.div key="itinerario" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 space-y-3">
            {savedItinerary ? (
              // Show structured days from saved itinerary
              savedItinerary.itinerary.map((day) => (
                <div key={day.day}>
                  <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                    Giorno {day.day} · {day.theme}
                  </h2>
                  {day.stops.map((stop) => {
                    const gameStop = game.stops.find((gs) => gs.poi.id === stop.poi_id);
                    const isCompleted = gameStop?.completed ?? false;
                    const isOwned = territories.some((t) => t.poi_id === stop.poi_id && t.user_id === user?.id);

                    return (
                      <motion.div
                        key={stop.poi_id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`glass rounded-xl p-4 mb-2 ${isCompleted ? "border border-green-500/20" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isCompleted ? "bg-green-500/20" : "bg-white/5"
                          }`}>
                            {isCompleted ? <span className="text-green-400 text-xs">✓</span> : <MapPin size={12} className="text-white/30" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-semibold text-sm">{stop.poi_name}</h3>
                              <span className="text-[10px] text-white/40 flex-shrink-0">{stop.arrival_time}</span>
                            </div>
                            {stop.tips && <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{stop.tips}</p>}
                            <div className="flex items-center gap-3 mt-2">
                              <button
                                onClick={() => router.push(`/tappa/${stop.poi_id}`)}
                                className="text-xs text-primary-light font-medium"
                              >
                                Dettagli →
                              </button>
                              {isCompleted && !isOwned && (
                                <button
                                  onClick={() => handleDefend(stop.poi_id)}
                                  disabled={defending === stop.poi_id}
                                  className="flex items-center gap-1 bg-yellow-500/20 text-yellow-400 rounded-lg px-2 py-1 text-xs font-medium"
                                >
                                  <Shield size={11} />
                                  {defending === stop.poi_id ? "..." : "Conquista"}
                                </button>
                              )}
                              {isCompleted && isOwned && (
                                <button
                                  onClick={() => handleDefend(stop.poi_id)}
                                  disabled={defending === stop.poi_id}
                                  className="flex items-center gap-1 bg-blue-500/20 text-blue-400 rounded-lg px-2 py-1 text-xs font-medium"
                                >
                                  <Shield size={11} />
                                  {defending === stop.poi_id ? "..." : "Difendi"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  {(day.lunch_suggestion || day.dinner_suggestion) && (
                    <div className="flex gap-2 mb-3">
                      {day.lunch_suggestion && (
                        <div className="glass rounded-xl p-2 flex items-center gap-1.5 flex-1">
                          <Utensils size={11} className="text-orange-400 flex-shrink-0" />
                          <p className="text-[11px] text-white/60 truncate">{day.lunch_suggestion}</p>
                        </div>
                      )}
                      {day.dinner_suggestion && (
                        <div className="glass rounded-xl p-2 flex items-center gap-1.5 flex-1">
                          <span className="text-xs flex-shrink-0">🌙</span>
                          <p className="text-[11px] text-white/60 truncate">{day.dinner_suggestion}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              // Fallback: show board stops
              game.stops.map((stop, i) => {
                const isCompleted = stop.completed;
                const isOwned = territories.some((t) => t.poi_id === stop.poi.id && t.user_id === user?.id);
                return (
                  <motion.div
                    key={stop.poi.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`glass rounded-xl p-4 ${isCompleted ? "border border-green-500/20" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isCompleted ? "bg-green-500/20" : i === game.currentStopIndex ? "bg-primary/30" : "bg-white/5"
                      }`}>
                        <span className="text-xs font-bold text-white/60">{i + 1}</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm">{stop.poi.name}</h3>
                        <p className="text-xs text-white/40 capitalize">{stop.type}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <button
                            onClick={() => router.push(`/tappa/${stop.poi.id}`)}
                            className="text-xs text-primary-light font-medium"
                          >
                            Dettagli →
                          </button>
                          {isCompleted && !isOwned && (
                            <button
                              onClick={() => handleDefend(stop.poi.id)}
                              disabled={defending === stop.poi.id}
                              className="flex items-center gap-1 bg-yellow-500/20 text-yellow-400 rounded-lg px-2 py-1 text-xs font-medium"
                            >
                              <Shield size={11} />
                              {defending === stop.poi.id ? "..." : "Conquista"}
                            </button>
                          )}
                          {isCompleted && isOwned && (
                            <button
                              onClick={() => handleDefend(stop.poi.id)}
                              disabled={defending === stop.poi.id}
                              className="flex items-center gap-1 bg-blue-500/20 text-blue-400 rounded-lg px-2 py-1 text-xs font-medium"
                            >
                              <Shield size={11} />
                              {defending === stop.poi.id ? "..." : "Difendi"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
