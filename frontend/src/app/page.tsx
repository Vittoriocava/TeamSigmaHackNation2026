"use client";

import { BottomNav } from "@/components/UI/BottomNav";
import { Card } from "@/components/UI/Card";
import { useStore } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import {
    Bell,
    ChevronRight,
    MapPin,
    Search,
    Shield,
    Trophy,
    Users,
    Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Mock data for demo
const MOCK_TRIPS = [
  { city: "Roma", slug: "roma", progress: 37, pois: 12, color: "#EF4444" },
  { city: "Bologna", slug: "bologna", progress: 0, pois: 0, color: "#3B82F6" },
];

const MOCK_ALERTS = [
  { type: "decay", text: "Tivoli scade tra 2 giorni", icon: Shield },
  { type: "quiz", text: "3 sessioni quiz attive ora", icon: Zap },
  { type: "suggestion", text: "Spello è vicina a te", icon: MapPin },
];

export default function HomePage() {
  const router = useRouter();
  const { user, profile, isHydrated } = useStore();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Aspetta l'idratazione del localStorage
    if (!isHydrated) return;
    
    // Reindirizza al login se non loggato
    if (!user) {
      router.replace("/auth");
    }
  }, [isHydrated, user, router]);

  // Non mostrare niente finché non è idratato
  if (!isHydrated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold">
              Play The City
            </h1>
            <p className="text-white/50 text-sm mt-1">
              {user ? `Ciao ${user.displayName}` : "Vivi la città da player"}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/profilo")}
              className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center"
            >
              <Users size={18} className="text-primary-light" />
            </button>
            <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center relative">
              <Bell size={18} />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center">
                3
              </span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
          />
          <input
            type="text"
            placeholder="Dove andiamo?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQuery.trim()) {
                router.push(
                  `/board/new?city=${encodeURIComponent(searchQuery)}`
                );
              }
            }}
            className="w-full glass rounded-2xl py-3.5 pl-11 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </header>

      {/* Quick Actions — DA CASA */}
      <section className="px-4 mb-6">
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push("/swipe")}
            className="flex-1 glass rounded-2xl p-3 flex flex-col items-center gap-2"
          >
            <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
              <span className="text-lg">💘</span>
            </div>
            <span className="text-xs font-medium text-white/80">
              Tinder Posti
            </span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push("/quiz-live")}
            className="flex-1 glass rounded-2xl p-3 flex flex-col items-center gap-2"
          >
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Zap size={18} className="text-yellow-400" />
            </div>
            <span className="text-xs font-medium text-white/80">
              Quiz Live
            </span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push("/territorio")}
            className="flex-1 glass rounded-2xl p-3 flex flex-col items-center gap-2"
          >
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <Shield size={18} className="text-green-400" />
            </div>
            <span className="text-xs font-medium text-white/80">
              Territori
            </span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push("/profilo")}
            className="flex-1 glass rounded-2xl p-3 flex flex-col items-center gap-2"
          >
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Trophy size={18} className="text-purple-400" />
            </div>
            <span className="text-xs font-medium text-white/80">
              Classifica
            </span>
          </motion.button>
        </div>
      </section>

      {/* I Tuoi Viaggi */}
      <section className="px-4 mb-6">
        <h2 className="font-display text-lg font-semibold mb-3">
          I tuoi viaggi
        </h2>
        <div className="flex gap-3 overflow-x-auto pt-2 pb-2 -mx-4 px-4 scrollbar-hide">
          {MOCK_TRIPS.map((trip) => (
            <Card
              key={trip.slug}
              onClick={() =>
                router.push(`/board/${trip.slug}`)
              }
              className="min-w-[140px] flex-shrink-0"
            >
              <div
                className="w-full h-20 rounded-xl mb-2 flex items-end p-2"
                style={{
                  background: `linear-gradient(135deg, ${trip.color}40, ${trip.color}10)`,
                }}
              >
                <MapPin size={16} style={{ color: trip.color }} />
              </div>
              <h3 className="font-semibold text-sm">{trip.city}</h3>
              {trip.progress > 0 ? (
                <div className="mt-1">
                  <div className="h-1.5 bg-white/10 rounded-full">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${trip.progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-white/50 mt-1">
                    {trip.progress}% esplorato
                  </span>
                </div>
              ) : (
                <span className="text-[10px] text-white/50">
                  Prossimo viaggio
                </span>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* Scopri Ora — Notifiche attive */}
      <section className="px-4 mb-6">
        <h2 className="font-display text-lg font-semibold mb-3">Scopri ora</h2>
        <AnimatePresence>
          {MOCK_ALERTS.map((alert, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-xl p-3 mb-2 flex items-center gap-3"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  alert.type === "decay"
                    ? "bg-yellow-500/20"
                    : alert.type === "quiz"
                    ? "bg-blue-500/20"
                    : "bg-green-500/20"
                }`}
              >
                <alert.icon size={14} />
              </div>
              <span className="text-sm flex-1">{alert.text}</span>
              <ChevronRight size={16} className="text-white/30" />
            </motion.div>
          ))}
        </AnimatePresence>
      </section>

      {/* Giocatori attivi */}
      <section className="px-4 mb-6">
        <Card animate={false} className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full bg-primary/30 border-2 border-gray-950 flex items-center justify-center text-xs"
              >
                {["🇮🇹", "🇬🇧", "🇫🇷"][i]}
              </div>
            ))}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              <span className="text-green-400">42</span> giocatori attivi ora
            </p>
            <p className="text-[10px] text-white/50">
              Roma (18) · Napoli (12) · Firenze (8) · altri
            </p>
          </div>
        </Card>
      </section>

      {/* Modalità di Gioco */}
      <section className="px-4 mb-24">
        <h2 className="font-display text-lg font-semibold mb-3">
          Organizza un viaggio
        </h2>
        <div className="space-y-2">
          {[
            {
              mode: "solo",
              title: "Avventura Solo",
              desc: "Percorso AI personalizzato solo per te",
              emoji: "🎯",
            },
            {
              mode: "group",
              title: "Gruppo",
              desc: "Gioca con amici, sfida cooperativa",
              emoji: "👥",
            },
            {
              mode: "open",
              title: "Sessione Aperta",
              desc: "Matchmaking con altri player in città",
              emoji: "🌍",
            },
          ].map((m) => (
            <Card
              key={m.mode}
              onClick={() =>
                router.push(`/board/new?mode=${m.mode}`)
              }
              className="flex items-center gap-4"
            >
              <span className="text-2xl">{m.emoji}</span>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">{m.title}</h3>
                <p className="text-xs text-white/50">{m.desc}</p>
              </div>
              <ChevronRight size={16} className="text-white/30" />
            </Card>
          ))}
        </div>
      </section>

      <BottomNav />
    </div>
  );
}
