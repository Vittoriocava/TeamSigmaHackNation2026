"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Star, Clock, Wallet, Users } from "lucide-react";
import { useStore, RankedPOI } from "@/lib/store";
import { apiPost } from "@/lib/api";

const CATEGORY_COLORS: Record<string, string> = {
  museum: "bg-purple-500/30 text-purple-300",
  monument: "bg-amber-500/30 text-amber-300",
  church: "bg-blue-500/30 text-blue-300",
  restaurant: "bg-red-500/30 text-red-300",
  park: "bg-green-500/30 text-green-300",
  attraction: "bg-pink-500/30 text-pink-300",
  viewpoint: "bg-sky-500/30 text-sky-300",
  theatre: "bg-violet-500/30 text-violet-300",
  castle: "bg-yellow-500/30 text-yellow-300",
  archaeological_site: "bg-orange-500/30 text-orange-300",
};

const CATEGORY_EMOJI: Record<string, string> = {
  museum: "🏛️", monument: "🗿", church: "⛪", restaurant: "🍽️",
  park: "🌿", attraction: "🎯", viewpoint: "👁️", theatre: "🎭",
  castle: "🏰", archaeological_site: "🏺",
};

export default function PoisPage() {
  const params = useParams();
  const city = decodeURIComponent(params.city as string);
  const router = useRouter();
  const { trip, setTrip, token } = useStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!trip.tripProfile) {
      router.replace(`/pianifica/${encodeURIComponent(city)}`);
      return;
    }
    if (trip.rankedPois.length > 0 && trip.city === city) return;

    fetchPois();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPois = async () => {
    if (!trip.tripProfile) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiPost<{ pois: RankedPOI[]; city: string; total: number }>(
        "/api/trip/pois",
        {
          city,
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
            cultural_level: trip.tripProfile.experienceType === "esploratore" ? "appassionato" : "casual",
            pace: trip.tripProfile.pace,
            language: "it",
          },
        },
        token ?? undefined,
        60000
      );
      setTrip({ rankedPois: data.pois as RankedPOI[] });
    } catch {
      setError("Errore nel caricare i posti. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  const relevanceBar = (score: number) => {
    const pct = Math.round((score / 10) * 100);
    const color =
      pct >= 80 ? "bg-green-400" : pct >= 60 ? "bg-yellow-400" : "bg-white/40";
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-white/50">{score.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <header className="px-4 pt-12 pb-4 sticky top-0 z-10 bg-black/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-full glass flex items-center justify-center">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1">
            <p className="text-white/50 text-xs">Posti consigliati per te</p>
            <h1 className="font-display text-lg font-bold">{city}</h1>
          </div>
          {trip.tripProfile && (
            <div className="flex gap-1.5">
              <span className="text-xs glass px-2 py-1 rounded-full">{trip.tripProfile.days}gg</span>
              <span className="text-xs glass px-2 py-1 rounded-full capitalize">{trip.tripProfile.budget}</span>
            </div>
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
          <p className="font-semibold text-lg mb-2">L'AI sta scegliendo per te</p>
          <p className="text-sm text-white/50">
            Sto analizzando {city} in base al tuo profilo...
          </p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="px-4 py-8 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={fetchPois} className="glass px-6 py-3 rounded-2xl text-sm font-medium">
            Riprova
          </button>
        </div>
      )}

      {/* POI List */}
      {!loading && !error && trip.rankedPois.length > 0 && (
        <div className="px-4 pt-4 space-y-3">
          <p className="text-sm text-white/50 mb-4">
            {trip.rankedPois.length} posti selezionati e ordinati per te
          </p>
          {trip.rankedPois.map((poi, index) => (
            <motion.div
              key={poi.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass rounded-2xl p-4"
            >
              <div className="flex items-start gap-3">
                {/* Rank number */}
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-white/70">
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  {/* Name + badges */}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-sm">{poi.name}</h3>
                    {poi.hidden_gem && (
                      <span className="flex items-center gap-1 text-[10px] bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">
                        <Star size={9} /> Hidden gem
                      </span>
                    )}
                  </div>

                  {/* Category */}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium inline-block mb-2 ${CATEGORY_COLORS[poi.category] ?? "bg-white/10 text-white/60"}`}>
                    {CATEGORY_EMOJI[poi.category] ?? "📍"} {poi.category}
                  </span>

                  {/* Why for you */}
                  {poi.why_for_you && (
                    <p className="text-xs text-primary-light italic mb-2">"{poi.why_for_you}"</p>
                  )}

                  {/* Description */}
                  <p className="text-xs text-white/60 line-clamp-2 mb-2">{poi.description}</p>

                  {/* Relevance bar */}
                  {relevanceBar(poi.relevance_score)}

                  {/* Meta info */}
                  <div className="flex gap-3 mt-2 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] text-white/40">
                      <Wallet size={10} /> {poi.estimated_cost}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-white/40">
                      <Clock size={10} /> {poi.estimated_duration ?? 45} min
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-white/40">
                      <Users size={10} /> folla {poi.crowd_level}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* CTA */}
      {!loading && trip.rankedPois.length > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-8 pt-4 bg-gradient-to-t from-black/80 to-transparent">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push(`/pianifica/${encodeURIComponent(city)}/swipe`)}
            className="w-full py-4 rounded-2xl font-semibold bg-primary text-white flex items-center justify-center gap-2"
          >
            Scegli i tuoi posti <ChevronRight size={18} />
          </motion.button>
          <p className="text-center text-xs text-white/30 mt-2">
            Swipe per scegliere cosa visitare
          </p>
        </div>
      )}
    </div>
  );
}
