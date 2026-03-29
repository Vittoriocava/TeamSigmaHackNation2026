"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Shield, Clock, Trophy, AlertTriangle, Loader } from "lucide-react";
import { Card } from "@/components/UI/Card";
import { Button } from "@/components/UI/Button";
import { BottomNav } from "@/components/UI/BottomNav";
import { useStore } from "@/lib/store";
import { apiGet } from "@/lib/api";
import type { MapPOI } from "@/components/Map/GameMap";

const GameMap = dynamic(
  () => import("@/components/Map/GameMap").then((m) => m.GameMap),
  { ssr: false, loading: () => <div className="w-full h-64 bg-gray-800 rounded-2xl animate-pulse" /> }
);

interface Territory {
  id: string;
  poi_id: string;
  city_slug: string;
  conquered_at: string;
  last_defended_at: string;
  weeks_held: number;
  tier: number;
}

interface TerritoryDisplay extends Territory {
  name: string;
  lat: number;
  lng: number;
  city: string;
  days_left: number;
}

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Stabile", color: "text-green-400" },
  2: { label: "Guardiano", color: "text-blue-400" },
  3: { label: "Leggenda", color: "text-yellow-400" },
};

const DECAY_DAYS = 7;

export default function TerritorioPage() {
  const { user, token, isHydrated, savedItineraries, currentGame } = useStore();
  const [territories, setTerritories] = useState<TerritoryDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(null);

  useEffect(() => {
    if (!isHydrated || !user) return;

    const fetchTerritories = async () => {
      try {
        const data = await apiGet<{ territories: Territory[] }>(
          `/api/territory/user/${user.id}`,
          token ?? undefined,
        );

        // Build a lookup for POI names/coords from saved itineraries + current game
        const poiLookup: Record<string, { name: string; lat: number; lng: number; city: string }> = {};

        if (currentGame) {
          for (const stop of currentGame.stops) {
            poiLookup[stop.poi.id] = {
              name: stop.poi.name,
              lat: stop.poi.lat,
              lng: stop.poi.lng,
              city: currentGame.city,
            };
          }
        }

        for (const itin of savedItineraries) {
          if (itin.pois) {
            for (const poi of itin.pois) {
              if (!poiLookup[poi.id]) {
                poiLookup[poi.id] = { name: poi.name, lat: poi.lat, lng: poi.lng, city: itin.city };
              }
            }
          }
          for (const day of itin.itinerary) {
            for (const stop of day.stops) {
              if (!poiLookup[stop.poi_id]) {
                poiLookup[stop.poi_id] = { name: stop.poi_name, lat: 0, lng: 0, city: itin.city };
              }
            }
          }
        }

        const enriched: TerritoryDisplay[] = (data.territories || []).map((t) => {
          const info = poiLookup[t.poi_id];
          const lastDefended = new Date(t.last_defended_at).getTime();
          const daysElapsed = Math.floor((Date.now() - lastDefended) / (1000 * 60 * 60 * 24));
          const daysLeft = Math.max(0, DECAY_DAYS - daysElapsed);

          return {
            ...t,
            name: info?.name || t.poi_id,
            lat: info?.lat || 0,
            lng: info?.lng || 0,
            city: info?.city || t.city_slug,
            days_left: daysLeft,
          };
        });

        setTerritories(enriched);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };

    fetchTerritories();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, user?.id]);

  const mapPois: MapPOI[] = territories
    .filter((t) => t.lat !== 0 && t.lng !== 0)
    .map((t) => ({
      id: t.poi_id,
      name: t.name,
      lat: t.lat,
      lng: t.lng,
      status: t.days_left <= 2 ? "decaying" : "conquered",
    }));

  const mapCenter: [number, number] = mapPois.length > 0
    ? [mapPois[0].lat, mapPois[0].lng]
    : [41.9, 12.49];

  const maxWeeks = territories.reduce((max, t) => Math.max(max, t.weeks_held), 0);

  return (
    <div className="min-h-screen pb-20">
      <header className="px-4 pt-12 pb-4">
        <h1 className="font-display text-2xl font-bold">I tuoi territori</h1>
        <p className="text-white/50 text-sm mt-1">
          {loading ? "Caricamento..." : `${territories.length} territori attivi`}
        </p>
      </header>

      {/* Map */}
      <section className="px-4 mb-4">
        <div className="h-[250px] rounded-2xl overflow-hidden">
          <GameMap
            pois={mapPois}
            center={mapCenter}
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
            <p className="text-lg font-bold">{territories.length}</p>
            <p className="text-[10px] text-white/50">Attivi</p>
          </Card>
          <Card animate={false} className="flex-1 text-center">
            <Trophy size={20} className="text-yellow-400 mx-auto mb-1" />
            <p className="text-lg font-bold">{territories.length}</p>
            <p className="text-[10px] text-white/50">Totali</p>
          </Card>
          <Card animate={false} className="flex-1 text-center">
            <Clock size={20} className="text-blue-400 mx-auto mb-1" />
            <p className="text-lg font-bold">{maxWeeks}</p>
            <p className="text-[10px] text-white/50">Settimane max</p>
          </Card>
        </div>
      </section>

      {/* Territory list */}
      <section className="px-4">
        <h2 className="font-semibold mb-3">Proprietà attive</h2>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader size={24} className="animate-spin text-primary" />
          </div>
        ) : territories.length === 0 ? (
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-white/50 text-sm">Nessun territorio conquistato</p>
            <p className="text-xs text-white/30 mt-1">Completa i quiz e visita i luoghi per conquistarli!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {territories.map((t) => {
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
                      style={{ width: `${(t.days_left / DECAY_DAYS) * 100}%` }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      <div className="h-20" />
      <BottomNav />
    </div>
  );
}
