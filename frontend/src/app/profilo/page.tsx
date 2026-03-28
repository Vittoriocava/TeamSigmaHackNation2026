"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  User, Shield, Trophy, Coins, MapPin, Puzzle,
  Settings, ChevronRight, Star, Flame,
} from "lucide-react";
import { Card } from "@/components/UI/Card";
import { Button } from "@/components/UI/Button";
import { BottomNav } from "@/components/UI/BottomNav";

const MOCK_USER = {
  displayName: "Leonardo",
  level: 8,
  xp: 1250,
  xpNext: 2000,
  coins: 340,
  territories: 3,
  totalConquered: 12,
  achievements: ["Esploratore", "Guardiano", "Quiz Master"],
  interests: ["storia", "arte", "food", "architettura"],
  streak: 5,
};

const MOCK_LEADERBOARD = [
  { rank: 1, name: "GladiatorMax", score: 8420, level: 22 },
  { rank: 2, name: "RomaQueen", score: 7100, level: 19 },
  { rank: 3, name: "BorgheseKid", score: 6200, level: 16 },
  { rank: 7, name: "Leonardo", score: 3400, level: 8, isYou: true },
];

export default function ProfiloPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"profilo" | "classifica">("profilo");

  return (
    <div className="min-h-screen pb-20">
      <header className="px-4 pt-12 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Profilo</h1>
          <button className="glass rounded-full p-2">
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Profile card */}
      <section className="px-4 mb-4">
        <Card animate={false} className="text-center py-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-3 text-3xl">
            {MOCK_USER.displayName[0]}
          </div>
          <h2 className="font-display text-xl font-bold">
            {MOCK_USER.displayName}
          </h2>
          <p className="text-sm text-white/50">Livello {MOCK_USER.level}</p>

          {/* XP bar */}
          <div className="mt-3 px-8">
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                initial={{ width: 0 }}
                animate={{
                  width: `${(MOCK_USER.xp / MOCK_USER.xpNext) * 100}%`,
                }}
                transition={{ duration: 1, delay: 0.3 }}
              />
            </div>
            <p className="text-[10px] text-white/40 mt-1">
              {MOCK_USER.xp}/{MOCK_USER.xpNext} XP
            </p>
          </div>

          {/* Stats row */}
          <div className="flex justify-center gap-6 mt-4">
            <div className="text-center">
              <Coins size={18} className="text-yellow-400 mx-auto mb-1" />
              <p className="font-bold">{MOCK_USER.coins}</p>
              <p className="text-[10px] text-white/40">Monete</p>
            </div>
            <div className="text-center">
              <Shield size={18} className="text-green-400 mx-auto mb-1" />
              <p className="font-bold">{MOCK_USER.territories}</p>
              <p className="text-[10px] text-white/40">Territori</p>
            </div>
            <div className="text-center">
              <MapPin size={18} className="text-blue-400 mx-auto mb-1" />
              <p className="font-bold">{MOCK_USER.totalConquered}</p>
              <p className="text-[10px] text-white/40">Conquistati</p>
            </div>
            <div className="text-center">
              <Flame size={18} className="text-orange-400 mx-auto mb-1" />
              <p className="font-bold">{MOCK_USER.streak}</p>
              <p className="text-[10px] text-white/40">Streak</p>
            </div>
          </div>
        </Card>
      </section>

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="flex gap-1 glass rounded-xl p-1">
          <button
            onClick={() => setTab("profilo")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "profilo" ? "bg-primary text-white" : "text-white/50"
            }`}
          >
            Profilo
          </button>
          <button
            onClick={() => setTab("classifica")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "classifica" ? "bg-primary text-white" : "text-white/50"
            }`}
          >
            Classifica
          </button>
        </div>
      </div>

      {tab === "profilo" && (
        <section className="px-4 space-y-4">
          {/* Interests */}
          <div>
            <h3 className="font-semibold text-sm mb-2">I tuoi interessi</h3>
            <div className="flex flex-wrap gap-2">
              {MOCK_USER.interests.map((interest) => (
                <span
                  key={interest}
                  className="glass rounded-full px-3 py-1 text-xs"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>

          {/* Achievements */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Achievement</h3>
            <div className="flex gap-2">
              {MOCK_USER.achievements.map((ach) => (
                <div
                  key={ach}
                  className="glass rounded-xl p-3 text-center flex-1"
                >
                  <Star size={20} className="text-yellow-400 mx-auto mb-1" />
                  <p className="text-[10px] font-medium">{ach}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="space-y-2">
            {[
              { label: "I miei territori", icon: Shield, href: "/territorio" },
              { label: "Tinder dei Posti", icon: Puzzle, href: "/swipe" },
              { label: "Modifica profilo", icon: User, href: "/onboarding" },
            ].map((action) => (
              <Card
                key={action.label}
                onClick={() => router.push(action.href)}
                className="flex items-center gap-3"
              >
                <action.icon size={18} className="text-white/60" />
                <span className="text-sm flex-1">{action.label}</span>
                <ChevronRight size={16} className="text-white/30" />
              </Card>
            ))}
          </div>
        </section>
      )}

      {tab === "classifica" && (
        <section className="px-4">
          {/* Leaderboard type selector */}
          <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide mb-4">
            {["Globale", "Roma", "Borghi", "Guardiani", "Settimanale"].map(
              (type) => (
                <button
                  key={type}
                  className="flex-shrink-0 glass rounded-xl px-3 py-2 text-xs font-medium text-white/60 hover:text-white"
                >
                  {type}
                </button>
              )
            )}
          </div>

          {/* Top 3 podium */}
          <div className="flex justify-center items-end gap-2 mb-6">
            {[MOCK_LEADERBOARD[1], MOCK_LEADERBOARD[0], MOCK_LEADERBOARD[2]].map(
              (player, i) => {
                const heights = [80, 100, 60];
                const medals = ["🥈", "🥇", "🥉"];
                return (
                  <motion.div
                    key={player.rank}
                    initial={{ height: 0 }}
                    animate={{ height: heights[i] }}
                    transition={{ delay: i * 0.2, duration: 0.5 }}
                    className="glass rounded-t-xl w-24 flex flex-col items-center justify-end pb-2"
                  >
                    <span className="text-2xl mb-1">{medals[i]}</span>
                    <p className="text-xs font-semibold">{player.name}</p>
                    <p className="text-[10px] text-white/50">
                      {player.score}
                    </p>
                  </motion.div>
                );
              }
            )}
          </div>

          {/* Full list */}
          <div className="space-y-2">
            {MOCK_LEADERBOARD.map((player) => (
              <div
                key={player.rank}
                className={`glass rounded-xl p-3 flex items-center gap-3 ${
                  (player as { isYou?: boolean }).isYou ? "border border-primary/30" : ""
                }`}
              >
                <span className="text-sm font-bold w-6 text-white/50">
                  {player.rank}.
                </span>
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm">
                  {player.name[0]}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {player.name}
                    {(player as { isYou?: boolean }).isYou && (
                      <span className="text-primary-light text-xs ml-1">(Tu)</span>
                    )}
                  </p>
                  <p className="text-[10px] text-white/40">
                    Lv. {player.level}
                  </p>
                </div>
                <span className="font-mono font-bold text-sm">
                  {player.score}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="h-20" />
      <BottomNav />
    </div>
  );
}
