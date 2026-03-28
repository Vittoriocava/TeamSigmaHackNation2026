"use client";

import { apiGet } from "@/lib/api";
import { useStore } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ChevronLeft, Shield, Zap } from "lucide-react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const GameMap = dynamic(
  () => import("@/components/Map/GameMap").then((m) => m.GameMap),
  { ssr: false }
);

type Stop = {
  poi: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    category: string;
    description: string;
    hidden_gem: boolean;
  };
  type: string;
  content: Record<string, unknown>;
  completed: boolean;
};

interface OverviewResponse {
  game: { id: string; city: string; city_slug: string; status: string; mode: string };
  progress: number;
  stops: Stop[];
  days: { day: number; stops: Stop[] }[];
  pieces: Record<string, number>;
  territories: { id: string; poi_id: string; active: boolean }[];
}

export default function TripPage() {
  const router = useRouter();
  const params = useParams();
  const gameId = params.gameId as string;
  const { token, isHydrated, user } = useStore();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isHydrated) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    const fetchData = async () => {
      try {
        const res = await apiGet<OverviewResponse>(`/api/game/${gameId}/overview`, token || undefined);
        setData(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore nel caricamento");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [gameId, token, isHydrated, user, router]);

  if (!isHydrated || !user) return null;
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <AlertCircle className="text-red-400 mb-3" size={32} />
        <p className="text-sm text-white/60">{error || "Impossibile caricare il viaggio"}</p>
        <button onClick={() => router.back()} className="mt-4 text-primary">Torna indietro</button>
      </div>
    );
  }

  const { game, days, pieces, territories, stops } = data;
  const isFuture = game.status === "waiting";
  const isActive = game.status === "active";
  const isCompleted = game.status === "completed";

  return (
    <div className="min-h-screen pb-12">
      <header className="px-4 pt-10 pb-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="glass rounded-full p-2">
          <ChevronLeft size={18} />
        </button>
        <div>
          <p className="text-xs text-white/50">Viaggio · {game.status}</p>
          <h1 className="font-display text-xl font-bold">{game.city}</h1>
        </div>
      </header>

      {isActive && (
        <section className="px-4 mb-4">
          <div className="glass rounded-2xl overflow-hidden">
            <div className="h-72">
              <GameMap
                pois={stops.map((s, i) => ({
                  id: s.poi.id,
                  name: s.poi.name,
                  lat: s.poi.lat,
                  lng: s.poi.lng,
                  status: s.completed ? "conquered" : "fog",
                  type: s.type,
                }))}
                center={[stops[0]?.poi.lat || 41.9, stops[0]?.poi.lng || 12.5]}
                zoom={13}
                onPoiClick={() => {}}
              />
            </div>
            <div className="px-4 py-3 text-sm text-white/60">Mappa dei punti della città</div>
          </div>
        </section>
      )}

      {/* Itinerario per giorni */}
      {isActive && (
        <section className="px-4 mb-6">
          <h2 className="font-display text-lg font-semibold mb-3">Itinerario</h2>
          <div className="space-y-3">
            {days.map((day) => (
              <div key={day.day} className="glass rounded-2xl p-3">
                <p className="text-xs text-white/50 mb-2">Giorno {day.day}</p>
                <div className="space-y-2">
                  {day.stops.map((s, idx) => (
                    <div key={s.poi.id} className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center text-sm">{idx + 1}</div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{s.poi.name}</p>
                        <p className="text-[11px] text-white/50">{s.type}</p>
                      </div>
                      {s.completed && <span className="text-green-400 text-xs">✓</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quiz preparatori per viaggi futuri */}
      {isFuture && (
        <section className="px-4 mb-6">
          <h2 className="font-display text-lg font-semibold mb-3">Quiz preparatori</h2>
          <AnimatePresence>
            {stops.map((s, i) => {
              const collected = pieces[s.poi.id] || 0;
              return (
                <motion.div
                  key={s.poi.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass rounded-xl p-3 mb-2 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Zap size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{s.poi.name}</p>
                    <p className="text-[11px] text-white/50">Pezzi raccolti: {collected}/3</p>
                  </div>
                  <button
                    className="text-xs glass rounded-full px-3 py-1 hover:bg-white/10"
                    onClick={() => router.push("/quiz-live")}
                  >
                    Fai il quiz
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </section>
      )}

      {/* Difendi territori se completato */}
      {(isCompleted || territories.length > 0) && (
        <section className="px-4 mb-10">
          <div className="glass rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <Shield size={18} className="text-yellow-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Difendi i tuoi territori</p>
              <p className="text-[11px] text-white/50">Proteggi i POI già conquistati in questa città</p>
            </div>
            <button
              className="text-xs glass rounded-full px-3 py-1 hover:bg-white/10"
              onClick={() => router.push("/territorio")}
            >
              Apri
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
