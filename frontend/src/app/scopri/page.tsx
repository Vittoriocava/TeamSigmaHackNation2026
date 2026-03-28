"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Camera, Utensils, Music, BookOpen, TreePine, ShoppingBag,
  Sparkles, Search, SlidersHorizontal,
} from "lucide-react";
import { Card } from "@/components/UI/Card";
import { BottomNav } from "@/components/UI/BottomNav";

const CATEGORIES = [
  { key: "instagrammabili", label: "Instagrammabili", icon: Camera, color: "bg-pink-500/20 text-pink-400" },
  { key: "food", label: "Food & Drink", icon: Utensils, color: "bg-orange-500/20 text-orange-400" },
  { key: "nightlife", label: "Vita Notturna", icon: Music, color: "bg-purple-500/20 text-purple-400" },
  { key: "cultura", label: "Musei & Cultura", icon: BookOpen, color: "bg-blue-500/20 text-blue-400" },
  { key: "natura", label: "Natura & Parchi", icon: TreePine, color: "bg-green-500/20 text-green-400" },
  { key: "shopping", label: "Shopping", icon: ShoppingBag, color: "bg-yellow-500/20 text-yellow-400" },
];

const MOCK_PLACES = [
  { id: "1", name: "Terrazza del Pincio", category: "instagrammabili", visited: true, description: "Vista mozzafiato su Roma al tramonto" },
  { id: "2", name: "Supplizio", category: "food", visited: false, description: "Il miglior supplì gourmet di Roma" },
  { id: "3", name: "Salotto 42", category: "nightlife", visited: false, description: "Cocktail bar letterario nel cuore di Roma" },
  { id: "4", name: "MAXXI", category: "cultura", visited: true, description: "Museo d'arte contemporanea di Zaha Hadid" },
  { id: "5", name: "Buco della Serratura", category: "instagrammabili", visited: false, description: "La vista perfetta su San Pietro dall'Aventino" },
  { id: "6", name: "Da Enzo al 29", category: "food", visited: false, description: "Cucina romana autentica a Trastevere" },
  { id: "7", name: "Lanificio 159", category: "nightlife", visited: false, description: "Club underground in un ex-lanificio" },
  { id: "8", name: "Galleria Borghese", category: "cultura", visited: false, description: "Bernini e Caravaggio in una villa rinascimentale" },
];

export default function ScopriPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = MOCK_PLACES.filter((p) => {
    if (activeCategory && p.category !== activeCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen pb-20">
      <header className="px-4 pt-12 pb-2">
        <h1 className="font-display text-2xl font-bold">Scopri</h1>
        <p className="text-white/50 text-sm mt-1">Roma — Guida città</p>
      </header>

      {/* Search */}
      <div className="px-4 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Cerca un posto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full glass rounded-xl py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <SlidersHorizontal size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" />
        </div>
      </div>

      {/* Categories */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() =>
                setActiveCategory(activeCategory === cat.key ? null : cat.key)
              }
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeCategory === cat.key
                  ? "bg-primary text-white"
                  : `glass text-white/60`
              }`}
            >
              <cat.icon size={14} />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI Suggestion */}
      <div className="px-4 mb-4">
        <Card animate={false} className="bg-gradient-to-r from-primary/20 to-accent/10 border-primary/20 flex items-center gap-3">
          <Sparkles size={20} className="text-accent flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Suggerimento AI per te</p>
            <p className="text-xs text-white/60">
              Basato sul tuo profilo: prova il Buco della Serratura al tramonto
            </p>
          </div>
        </Card>
      </div>

      {/* Places list */}
      <section className="px-4">
        <div className="space-y-2">
          {filtered.map((place, i) => (
            <motion.div
              key={place.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card
                onClick={() => router.push(`/tappa/${place.id}`)}
                className={`flex items-center gap-3 ${
                  !place.visited ? "opacity-70" : ""
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    place.visited
                      ? "bg-green-500/20"
                      : "bg-white/5"
                  }`}
                >
                  {place.visited ? (
                    <span className="text-green-400 text-lg">✓</span>
                  ) : (
                    <div className="w-full h-full rounded-xl bg-gray-700/50 flex items-center justify-center">
                      <span className="text-white/20 text-xs">?</span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">{place.name}</h3>
                  <p className="text-[10px] text-white/50">
                    {place.description}
                  </p>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    CATEGORIES.find((c) => c.key === place.category)?.color ||
                    "glass"
                  }`}
                >
                  {place.category}
                </span>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <div className="h-20" />
      <BottomNav />
    </div>
  );
}
