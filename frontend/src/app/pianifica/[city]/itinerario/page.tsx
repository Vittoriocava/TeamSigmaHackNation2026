"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Clock, MapPin, Utensils,
  Moon, Wallet, Navigation, Play, RotateCcw
} from "lucide-react";
import { useStore, ItineraryDay, ItineraryStop } from "@/lib/store";
import { apiPost } from "@/lib/api";

const TRANSPORT_ICON: Record<string, string> = {
  piedi: "🚶", bus: "🚌", metro: "🚇", taxi: "🚕", bici: "🚲", tram: "🚋",
};

const COST_COLOR: Record<string, string> = {
  "€": "text-green-400",
  "€€": "text-yellow-400",
  "€€€": "text-orange-400",
};

export default function ItinerarioPage() {
  const params = useParams();
  const city = decodeURIComponent(params.city as string);
  const router = useRouter();
  const { trip, setTrip, saveItinerary, savedItineraries, token } = useStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeDay, setActiveDay] = useState(0);

  useEffect(() => {
    // Check if there's a saved itinerary for this city we can restore
    if (trip.itinerary.length > 0 && trip.city === city) return;

    const saved = savedItineraries.find((s) => s.city === city);
    if (saved) {
      setTrip({
        city: saved.city,
        itinerary: saved.itinerary,
        tripProfile: saved.tripProfile,
        likedPois: [],
        rankedPois: [],
      });
      return;
    }

    if (!trip.tripProfile) {
      router.replace(`/pianifica/${encodeURIComponent(city)}`);
      return;
    }
    if (trip.likedPois.length === 0) {
      router.replace(`/pianifica/${encodeURIComponent(city)}/swipe`);
      return;
    }

    generateItinerary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateItinerary = async () => {
    if (!trip.tripProfile || trip.likedPois.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiPost<{ days: ItineraryDay[]; city: string; total_days: number }>(
        "/api/trip/itinerary",
        {
          city,
          all_pois: trip.likedPois.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            description: p.description,
            estimated_duration: p.estimated_duration ?? 45,
            estimated_cost: p.estimated_cost,
            lat: p.lat,
            lng: p.lng,
          })),
          trip_profile: {
            days: trip.tripProfile.days,
            budget: trip.tripProfile.budget,
            group: trip.tripProfile.group,
            interests: trip.tripProfile.interests,
            pace: trip.tripProfile.pace,
            experience_type: trip.tripProfile.experienceType,
          },
          user_profile: {
            interests: trip.tripProfile.interests,
            cultural_level: "casual",
            pace: trip.tripProfile.pace,
            language: "it",
          },
        },
        token ?? undefined,
        90000
      );
      const generatedDays = data.days as ItineraryDay[];
      setTrip({ itinerary: generatedDays });
      if (trip.tripProfile) {
        saveItinerary({
          id: `itin-${Date.now()}`,
          city,
          createdAt: new Date().toISOString(),
          days: trip.tripProfile.days,
          likedPoisCount: trip.likedPois.length,
          itinerary: generatedDays,
          tripProfile: trip.tripProfile,
          startDate: trip.tripProfile.startDate,
          pois: trip.likedPois.map((p) => ({
            id: p.id,
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            category: p.category,
          })),
        });
        router.replace(`/viaggio/${encodeURIComponent(city)}`);
      }
    } catch {
      setError("Errore nella generazione dell'itinerario. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  const days = trip.itinerary;
  const currentDay = days[activeDay];

  const startAdventure = () => {
    router.push(`/board/new?city=${encodeURIComponent(city)}&mode=solo`);
  };

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <header className="px-4 pt-12 pb-4 sticky top-0 z-10 bg-black/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="w-10 h-10 rounded-full glass flex items-center justify-center">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1">
            <p className="text-white/50 text-xs">Il tuo itinerario</p>
            <h1 className="font-display text-lg font-bold">{city}</h1>
          </div>
          {trip.tripProfile && (
            <span className="text-xs glass px-3 py-1 rounded-full">
              {trip.tripProfile.days} {trip.tripProfile.days === 1 ? "giorno" : "giorni"}
            </span>
          )}
        </div>
      </header>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent mb-6"
          />
          <p className="font-semibold text-lg mb-2">Costruendo il tuo itinerario</p>
          <p className="text-sm text-white/50">
            Organizzo {trip.likedPois.length} posti in {trip.tripProfile?.days} giorni...
          </p>
          <div className="mt-6 space-y-2 w-full max-w-xs">
            {["Analizzando le posizioni", "Ottimizzando i percorsi", "Aggiungendo suggerimenti locali"].map((t, i) => (
              <motion.div
                key={t}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 1.2 }}
                className="text-xs text-white/40 flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                {t}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="px-4 py-8 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={generateItinerary} className="glass px-6 py-3 rounded-2xl text-sm font-medium flex items-center gap-2 mx-auto">
            <RotateCcw size={14} /> Riprova
          </button>
        </div>
      )}

      {/* Itinerary */}
      {!loading && !error && days.length > 0 && (
        <div>
          {/* Day tabs */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {days.map((day, i) => (
                <motion.button
                  key={i}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveDay(i)}
                  className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeDay === i
                      ? "bg-primary text-white"
                      : "glass text-white/60"
                  }`}
                >
                  Giorno {day.day}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Day content */}
          <AnimatePresence mode="wait">
            {currentDay && (
              <motion.div
                key={activeDay}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="px-4 pt-2"
              >
                {/* Day theme */}
                <div className="glass rounded-2xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-white/40 mb-0.5">Tema del giorno</p>
                      <h2 className="font-display text-lg font-bold">{currentDay.theme}</h2>
                    </div>
                    <span className={`text-lg font-bold ${COST_COLOR[currentDay.total_cost_estimate] ?? "text-white/60"}`}>
                      {currentDay.total_cost_estimate}
                    </span>
                  </div>
                </div>

                {/* Stops */}
                <div className="space-y-3 mb-4">
                  {currentDay.stops.map((stop, idx) => (
                    <StopCard key={idx} stop={stop} index={idx} isLast={idx === currentDay.stops.length - 1} />
                  ))}
                </div>

                {/* Meals */}
                <div className="space-y-2 mb-6">
                  {currentDay.lunch_suggestion && (
                    <div className="glass rounded-2xl p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                        <Utensils size={16} className="text-orange-300" />
                      </div>
                      <div>
                        <p className="text-xs text-white/40">Pranzo</p>
                        <p className="text-sm font-medium">{currentDay.lunch_suggestion}</p>
                      </div>
                    </div>
                  )}
                  {currentDay.dinner_suggestion && (
                    <div className="glass rounded-2xl p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <Moon size={16} className="text-blue-300" />
                      </div>
                      <div>
                        <p className="text-xs text-white/40">Cena</p>
                        <p className="text-sm font-medium">{currentDay.dinner_suggestion}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Day nav */}
                <div className="flex gap-3 mb-4">
                  {activeDay > 0 && (
                    <button
                      onClick={() => setActiveDay(activeDay - 1)}
                      className="flex-1 glass py-3 rounded-xl text-sm flex items-center justify-center gap-2"
                    >
                      <ChevronLeft size={16} /> Giorno {activeDay}
                    </button>
                  )}
                  {activeDay < days.length - 1 && (
                    <button
                      onClick={() => setActiveDay(activeDay + 1)}
                      className="flex-1 glass py-3 rounded-xl text-sm flex items-center justify-center gap-2"
                    >
                      Giorno {activeDay + 2} <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* CTA */}
      {!loading && days.length > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-8 pt-4 bg-gradient-to-t from-black/80 to-transparent">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={startAdventure}
            className="w-full py-4 rounded-2xl font-semibold bg-primary text-white flex items-center justify-center gap-2 text-base"
          >
            <Play size={18} /> Inizia l'avventura a {city}
          </motion.button>
          <p className="text-center text-xs text-white/30 mt-2">
            Modalità gioco attivata · GPS + AR + Quiz
          </p>
        </div>
      )}
    </div>
  );
}

function StopCard({ stop, index, isLast }: { stop: ItineraryStop; index: number; isLast: boolean }) {
  return (
    <div className="flex gap-3">
      {/* Timeline */}
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-primary/30 border-2 border-primary flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold">{index + 1}</span>
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-white/10 my-1 min-h-[16px]" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-sm">{stop.poi_name}</h3>
            <span className="text-xs text-white/40 flex items-center gap-1 flex-shrink-0">
              <Clock size={10} /> {stop.arrival_time}
            </span>
          </div>

          <div className="flex gap-3 flex-wrap mb-2">
            <span className="text-xs text-white/40 flex items-center gap-1">
              <Clock size={10} /> {stop.duration_min} min
            </span>
            {stop.distance_from_prev && (
              <span className="text-xs text-white/40 flex items-center gap-1">
                <MapPin size={10} /> {stop.distance_from_prev}
              </span>
            )}
            {stop.transport && (
              <span className="text-xs text-white/50 flex items-center gap-1">
                {TRANSPORT_ICON[stop.transport.toLowerCase()] ?? "🚗"} {stop.transport}
              </span>
            )}
          </div>

          {stop.tips && (
            <div className="bg-white/5 rounded-xl px-3 py-2 mt-1">
              <p className="text-xs text-white/60 flex items-start gap-1.5">
                <Navigation size={10} className="text-primary-light mt-0.5 flex-shrink-0" />
                {stop.tips}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
