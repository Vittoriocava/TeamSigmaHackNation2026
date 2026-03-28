"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Shield, Clock, Trophy, AlertTriangle } from "lucide-react";
import { Card } from "@/components/UI/Card";
import { Button } from "@/components/UI/Button";
import { BottomNav } from "@/components/UI/BottomNav";
import type { MapPOI } from "@/components/Map/GameMap";

const GameMap = dynamic(
  () => import("@/components/Map/GameMap").then((m) => m.GameMap),
  { ssr: false, loading: () => <div className="w-full h-64 bg-gray-800 rounded-2xl animate-pulse" /> }
);

const MOCK_TERRITORIES = [
  { poi_id: "1", name: "Colosseo", lat: 41.8902, lng: 12.4922, tier: 2, weeks_held: 3, days_left: 5, city: "Roma" },
  { poi_id: "3", name: "Pantheon", lat: 41.8986, lng: 12.4769, tier: 1, weeks_held: 1, days_left: 2, city: "Roma" },
  { poi_id: "8", name: "Giardino degli Aranci", lat: 41.8836, lng: 12.4796, tier: 1, weeks_held: 0, days_left: 6, city: "Roma" },
];

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Stabile", color: "text-green-400" },
  2: { label: "Guardiano", color: "text-blue-400" },
  3: { label: "Leggenda", color: "text-yellow-400" },
};

export default function TerritorioPage() {
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(null);

  const mapPois: MapPOI[] = MOCK_TERRITORIES.map((t) => ({
    id: t.poi_id,
    name: t.name,
    lat: t.lat,
    lng: t.lng,
    status: t.days_left <= 2 ? "decaying" : "conquered",
  }));

  return (
    <div className="min-h-screen pb-20">
      <header className="px-4 pt-12 pb-4">
        <h1 className="font-display text-2xl font-bold">I tuoi territori</h1>
        <p className="text-white/50 text-sm mt-1">
          {MOCK_TERRITORIES.length} territori attivi
        </p>
      </header>

      {/* Map */}
      <section className="px-4 mb-4">
        <div className="h-[250px] rounded-2xl overflow-hidden">
          <GameMap
            pois={mapPois}
            center={[41.8902, 12.4922]}
            zoom={13}
            onPoiClick={(poi) => setSelectedTerritory(poi.id)}
          />
        </div>
      </section>

      {/* Stats */}
      <section className="px-4 mb-4">
        <div className="flex gap-2">
          <Card animate={false} className="flex-1 text-center">
            <Shield size={20} className="text-green-400 mx-auto mb-1" />
            <p className="text-lg font-bold">{MOCK_TERRITORIES.length}</p>
            <p className="text-[10px] text-white/50">Attivi</p>
          </Card>
          <Card animate={false} className="flex-1 text-center">
            <Trophy size={20} className="text-yellow-400 mx-auto mb-1" />
            <p className="text-lg font-bold">12</p>
            <p className="text-[10px] text-white/50">Totali</p>
          </Card>
          <Card animate={false} className="flex-1 text-center">
            <Clock size={20} className="text-blue-400 mx-auto mb-1" />
            <p className="text-lg font-bold">3</p>
            <p className="text-[10px] text-white/50">Settimane max</p>
          </Card>
        </div>
      </section>

      {/* Territory list */}
      <section className="px-4">
        <h2 className="font-semibold mb-3">Proprietà attive</h2>
        <div className="space-y-2">
          {MOCK_TERRITORIES.map((t) => {
            const tierInfo = TIER_LABELS[t.tier] || TIER_LABELS[1];
            const urgent = t.days_left <= 2;

            return (
              <motion.div
                key={t.poi_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass rounded-xl p-4 ${urgent ? "border border-yellow-500/30" : ""}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold">{t.name}</h3>
                    <p className="text-xs text-white/50">{t.city}</p>
                  </div>
                  <span className={`text-xs font-medium ${tierInfo.color}`}>
                    Tier {t.tier} · {tierInfo.label}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-white/60">
                    <span>{t.weeks_held} settimane</span>
                    <span className={urgent ? "text-yellow-400 flex items-center gap-1" : ""}>
                      {urgent && <AlertTriangle size={12} />}
                      {t.days_left} giorni rimasti
                    </span>
                  </div>
                  <Button variant="secondary" size="sm">
                    Difendi
                  </Button>
                </div>

                {/* Decay bar */}
                <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${urgent ? "bg-yellow-500" : "bg-green-500"}`}
                    style={{ width: `${(t.days_left / 7) * 100}%` }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* History */}
        <h2 className="font-semibold mt-6 mb-3 text-white/70">
          Proprietà passate
        </h2>
        <div className="space-y-2 opacity-60">
          {["Villa d'Este (Tivoli)", "Piazza Maggiore (Bologna)", "Ponte Vecchio (Firenze)"].map((name) => (
            <div key={name} className="glass rounded-xl p-3 flex items-center justify-between">
              <span className="text-sm">{name}</span>
              <span className="text-xs text-white/40">perso</span>
            </div>
          ))}
        </div>
      </section>

      <div className="h-20" />
      <BottomNav />
    </div>
  );
}
