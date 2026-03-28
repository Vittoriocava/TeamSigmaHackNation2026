"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft, Volume2, Camera, Clock, MapPin,
  Shield, Star, Share2, Puzzle,
} from "lucide-react";
import { Button } from "@/components/UI/Button";
import { Card } from "@/components/UI/Card";

// Mock POI data
const MOCK_POI = {
  id: "colosseo",
  name: "Colosseo",
  city: "Roma",
  category: "storia",
  description:
    "L'Anfiteatro Flavio, meglio noto come Colosseo, è il più grande anfiteatro del mondo romano. Costruito in soli 8 anni (72-80 d.C.), poteva ospitare tra 50.000 e 87.000 spettatori.",
  lat: 41.8902,
  lng: 12.4922,
  owner: { name: "GladiatorMax", tier: 2, weeks: 5 },
  pieces_collected: 2,
};

const TIMELINE_ERAS = [
  { label: "80 d.C.", year: 80, description: "Inaugurazione sotto Tito", image: "/placeholder-roman.jpg" },
  { label: "1200", year: 1200, description: "Fortezza dei Frangipane", image: "/placeholder-medieval.jpg" },
  { label: "1800", year: 1800, description: "Scavi archeologici", image: "/placeholder-1800.jpg" },
  { label: "1950", year: 1950, description: "Restauro post-bellico", image: "/placeholder-1950.jpg" },
  { label: "Oggi", year: 2024, description: "Patrimonio UNESCO", image: "/placeholder-today.jpg" },
];

export default function TappaPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"info" | "timeline" | "ar" | "pieces">("info");
  const [selectedEra, setSelectedEra] = useState(0);
  const [showAR, setShowAR] = useState(false);
  const [narrating, setNarrating] = useState(false);

  return (
    <div className="min-h-screen pb-8">
      {/* Hero area */}
      <div className="relative h-[280px]">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 to-gray-950" />
        <div className="absolute inset-0 flex items-end p-4">
          <div className="w-full">
            <button
              onClick={() => router.back()}
              className="glass rounded-full p-2 mb-4"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={14} className="text-primary-light" />
              <span className="text-xs text-white/60">{MOCK_POI.city}</span>
              <span className="text-xs glass px-2 py-0.5 rounded-full">
                {MOCK_POI.category}
              </span>
            </div>
            <h1 className="font-display text-3xl font-bold">{MOCK_POI.name}</h1>
          </div>
        </div>
      </div>

      {/* Owner badge */}
      {MOCK_POI.owner && (
        <div className="px-4 -mt-2 mb-4">
          <div className="glass rounded-xl p-3 flex items-center gap-3">
            <Shield size={18} className="text-blue-400" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                Territorio di{" "}
                <span className="text-blue-400">{MOCK_POI.owner.name}</span>
              </p>
              <p className="text-[10px] text-white/50">
                Tier {MOCK_POI.owner.tier} · {MOCK_POI.owner.weeks} settimane
              </p>
            </div>
            <Button variant="ghost" size="sm">
              👋 Saluta
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="flex gap-1 glass rounded-xl p-1">
          {[
            { key: "info", label: "Info" },
            { key: "timeline", label: "Timeline" },
            { key: "ar", label: "AR" },
            { key: "pieces", label: "Pezzi" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-primary text-white"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4">
        <AnimatePresence mode="wait">
          {activeTab === "info" && (
            <motion.div
              key="info"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-sm text-white/80 leading-relaxed mb-4">
                {MOCK_POI.description}
              </p>

              {/* Audio narration */}
              <Card
                onClick={() => setNarrating(!narrating)}
                className="flex items-center gap-3 mb-3"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    narrating ? "bg-primary animate-pulse" : "bg-primary/20"
                  }`}
                >
                  <Volume2 size={18} className="text-primary-light" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {narrating ? "In riproduzione..." : "Raccontami questo posto"}
                  </p>
                  <p className="text-[10px] text-white/50">
                    Narrazione AI · ~2 minuti
                  </p>
                </div>
                {narrating && (
                  <div className="flex gap-0.5 items-end h-6">
                    {[...Array(5)].map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{ height: [4, 16, 4] }}
                        transition={{ duration: 0.6, delay: i * 0.1, repeat: Infinity }}
                        className="w-1 bg-primary rounded-full"
                      />
                    ))}
                  </div>
                )}
              </Card>

              {/* Quick info */}
              <div className="grid grid-cols-3 gap-2">
                <Card animate={false} className="text-center">
                  <Clock size={16} className="text-white/50 mx-auto mb-1" />
                  <p className="text-sm font-bold">90 min</p>
                  <p className="text-[10px] text-white/40">Durata</p>
                </Card>
                <Card animate={false} className="text-center">
                  <span className="text-sm block mb-1">€€</span>
                  <p className="text-sm font-bold">12€</p>
                  <p className="text-[10px] text-white/40">Ingresso</p>
                </Card>
                <Card animate={false} className="text-center">
                  <Star size={16} className="text-yellow-400 mx-auto mb-1" />
                  <p className="text-sm font-bold">9.5</p>
                  <p className="text-[10px] text-white/40">Score</p>
                </Card>
              </div>
            </motion.div>
          )}

          {activeTab === "timeline" && (
            <motion.div
              key="timeline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h3 className="font-semibold mb-3">Linea del Tempo</h3>

              {/* Era selector */}
              <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide mb-4">
                {TIMELINE_ERAS.map((era, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedEra(i)}
                    className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      selectedEra === i
                        ? "bg-primary text-white"
                        : "glass text-white/60"
                    }`}
                  >
                    {era.label}
                  </button>
                ))}
              </div>

              {/* Image placeholder */}
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-3 border border-white/10">
                <div className="text-center">
                  <span className="text-4xl block mb-2">🏛️</span>
                  <p className="text-sm font-medium">
                    {MOCK_POI.name} — {TIMELINE_ERAS[selectedEra].label}
                  </p>
                  <p className="text-xs text-white/50 mt-1">
                    {TIMELINE_ERAS[selectedEra].description}
                  </p>
                  <p className="text-[10px] text-primary-light mt-2">
                    Immagine generata da DALL-E 3
                  </p>
                </div>
              </div>

              {/* Slider */}
              <input
                type="range"
                min={0}
                max={TIMELINE_ERAS.length - 1}
                value={selectedEra}
                onChange={(e) => setSelectedEra(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-white/40 mt-1">
                <span>{TIMELINE_ERAS[0].label}</span>
                <span>{TIMELINE_ERAS[TIMELINE_ERAS.length - 1].label}</span>
              </div>
            </motion.div>
          )}

          {activeTab === "ar" && (
            <motion.div
              key="ar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <Card
                onClick={() => setShowAR(true)}
                className="text-center py-8"
              >
                <Camera size={40} className="text-primary-light mx-auto mb-3" />
                <h3 className="font-display text-lg font-bold mb-1">
                  Come era
                </h3>
                <p className="text-sm text-white/60">
                  Scatta una foto e vedi il luogo nel passato
                </p>
                <Button className="mt-4">Apri Fotocamera</Button>
              </Card>

              <Card className="text-center py-8">
                <span className="text-4xl block mb-3">🤳</span>
                <h3 className="font-display text-lg font-bold mb-1">
                  Foto col Monumento
                </h3>
                <p className="text-sm text-white/60">
                  Fatti un selfie e viaggia nel tempo
                </p>
                <Button variant="secondary" className="mt-4">
                  Scatta Souvenir
                </Button>
              </Card>

              <Card className="text-center py-4">
                <Share2 size={20} className="text-white/50 mx-auto mb-2" />
                <p className="text-xs text-white/50">
                  Le foto AR hanno il watermark Play The City e sono
                  condivisibili
                </p>
              </Card>
            </motion.div>
          )}

          {activeTab === "pieces" && (
            <motion.div
              key="pieces"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h3 className="font-semibold mb-1">Pezzi del Monumento</h3>
              <p className="text-xs text-white/50 mb-4">
                Raccogli 3 pezzi da casa per pre-reclamare il territorio
              </p>

              {/* Pieces progress */}
              <div className="flex gap-3 justify-center mb-6">
                {[1, 2, 3].map((piece) => (
                  <div
                    key={piece}
                    className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl ${
                      piece <= MOCK_POI.pieces_collected
                        ? "bg-primary/30 border-2 border-primary"
                        : "glass border-2 border-dashed border-white/20"
                    }`}
                  >
                    {piece <= MOCK_POI.pieces_collected ? (
                      <Puzzle size={28} className="text-primary-light" />
                    ) : (
                      <span className="text-white/20">?</span>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-center text-sm mb-6">
                <span className="text-primary-light font-bold">
                  {MOCK_POI.pieces_collected}
                </span>
                /3 pezzi raccolti
              </p>

              {/* Quiz to earn pieces */}
              <Button className="w-full mb-3">
                Quiz sul Colosseo → Guadagna 1 pezzo
              </Button>
              <Button variant="secondary" className="w-full">
                GeoGuessr Roma → Guadagna 1 pezzo
              </Button>

              {MOCK_POI.pieces_collected >= 3 && (
                <div className="mt-4 glass-dark rounded-xl p-4 text-center border border-green-500/30">
                  <p className="text-green-400 font-semibold">
                    Pre-reclamo attivo!
                  </p>
                  <p className="text-xs text-white/50 mt-1">
                    Vai fisicamente al Colosseo per conquistare il territorio
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
