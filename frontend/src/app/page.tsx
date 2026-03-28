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
import { useEffect, useRef, useState } from "react";

// Tutti i capoluoghi di provincia italiani (107)
const ITALIAN_CITIES = [
  "Agrigento", "Alessandria", "Ancona", "Aosta", "Arezzo", "Ascoli Piceno",
  "Asti", "Avellino", "Bari", "Barletta", "Belluno", "Benevento", "Bergamo",
  "Biella", "Bologna", "Bolzano", "Brescia", "Brindisi", "Cagliari",
  "Caltanissetta", "Campobasso", "Caserta", "Catania", "Catanzaro", "Chieti",
  "Como", "Cosenza", "Cremona", "Crotone", "Cuneo", "Enna", "Fermo",
  "Ferrara", "Firenze", "Foggia", "Forlì", "Frosinone", "Genova", "Gorizia",
  "Grosseto", "Imperia", "Isernia", "L'Aquila", "La Spezia", "Latina",
  "Lecce", "Lecco", "Livorno", "Lodi", "Lucca", "Macerata", "Mantova",
  "Massa", "Matera", "Messina", "Milano", "Modena", "Monza", "Napoli",
  "Novara", "Nuoro", "Oristano", "Padova", "Palermo", "Parma", "Pavia",
  "Perugia", "Pesaro", "Pescara", "Piacenza", "Pisa", "Pistoia", "Pordenone",
  "Potenza", "Prato", "Ragusa", "Ravenna", "Reggio Calabria", "Reggio Emilia",
  "Rieti", "Rimini", "Roma", "Rovigo", "Salerno", "Sassari", "Savona",
  "Siena", "Siracusa", "Sondrio", "Sud Sardegna", "Taranto", "Teramo",
  "Terni", "Torino", "Trapani", "Trento", "Treviso", "Trieste", "Udine",
  "Varese", "Venezia", "Verbania", "Vercelli", "Verona", "Vibo Valentia",
  "Vicenza", "Viterbo",
  // Altre città
  "Scalea",
];

const MOCK_ALERTS = [
  { type: "decay", text: "Tivoli scade tra 2 giorni", icon: Shield },
  { type: "quiz", text: "3 sessioni quiz attive ora", icon: Zap },
  { type: "suggestion", text: "Spello è vicina a te", icon: MapPin },
];

const CITY_EMOJIS: Record<string, string> = {
  Roma: "🏛️", Firenze: "⛪", Venezia: "🚤", Napoli: "🍕", Milano: "🏙️", Bologna: "🎻",
};

export default function HomePage() {
  const router = useRouter();
  const { user, isHydrated } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isHydrated) return;
    if (!user) router.replace("/auth");
  }, [isHydrated, user, router]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSuggestions([]); return; }
    const q = searchQuery.toLowerCase();
    setSuggestions(ITALIAN_CITIES.filter((c) => c.toLowerCase().startsWith(q)).slice(0, 6));
  }, [searchQuery]);

  const goToCity = (city: string, mode = "solo") => {
    setShowSuggestions(false);
    router.push(`/board/new?city=${encodeURIComponent(city)}&mode=${mode}`);
  };

  if (!isHydrated || !user) return null;

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold">Play The City</h1>
            <p className="text-white/50 text-sm mt-1">Ciao {user.displayName}</p>
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
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center">3</span>
            </button>
          </div>
        </div>

        {/* Search + Autocomplete */}
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 z-10" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Dove andiamo? (es. Firenze)"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQuery.trim()) {
                const match = ITALIAN_CITIES.find((c) => c.toLowerCase() === searchQuery.toLowerCase());
                goToCity(match || searchQuery);
              }
            }}
            className="w-full glass rounded-2xl py-3.5 pl-11 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {showSuggestions && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-full left-0 right-0 mt-2 glass rounded-2xl overflow-hidden z-50"
            >
              {suggestions.map((city) => (
                <button
                  key={city}
                  onMouseDown={() => goToCity(city)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors text-left"
                >
                  <MapPin size={14} className="text-primary-light flex-shrink-0" />
                  <span className="text-sm">{city}</span>
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </header>

      {/* Quick Actions */}
      <section className="px-4 mb-6">
        <div className="flex gap-3">
          {[
            { label: "Tinder Posti", emoji: "💘", color: "bg-pink-500/20", href: "/swipe" },
            { label: "Quiz Live", icon: <Zap size={18} className="text-yellow-400" />, color: "bg-yellow-500/20", href: "/quiz-live" },
            { label: "Territori", icon: <Shield size={18} className="text-green-400" />, color: "bg-green-500/20", href: "/territorio" },
            { label: "Classifica", icon: <Trophy size={18} className="text-purple-400" />, color: "bg-purple-500/20", href: "/profilo" },
          ].map((item) => (
            <motion.button
              key={item.label}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push(item.href)}
              className="flex-1 glass rounded-2xl p-3 flex flex-col items-center gap-2"
            >
              <div className={`w-10 h-10 rounded-full ${item.color} flex items-center justify-center`}>
                {item.emoji ? <span className="text-lg">{item.emoji}</span> : item.icon}
              </div>
              <span className="text-xs font-medium text-white/80">{item.label}</span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Città popolari */}
      <section className="px-4 mb-6">
        <h2 className="font-display text-lg font-semibold mb-3">Città popolari</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {["Roma", "Firenze", "Venezia", "Napoli", "Milano", "Bologna"].map((city) => (
            <motion.button
              key={city}
              whileTap={{ scale: 0.95 }}
              onClick={() => goToCity(city)}
              className="flex-shrink-0 glass rounded-2xl px-4 py-3 flex flex-col items-center gap-1 min-w-[76px]"
            >
              <span className="text-xl">{CITY_EMOJIS[city] ?? "🗺️"}</span>
              <span className="text-xs font-medium text-white/80">{city}</span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Scopri ora */}
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
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${alert.type === "decay" ? "bg-yellow-500/20" : alert.type === "quiz" ? "bg-blue-500/20" : "bg-green-500/20"}`}>
                <alert.icon size={14} />
              </div>
              <span className="text-sm flex-1">{alert.text}</span>
              <ChevronRight size={16} className="text-white/30" />
            </motion.div>
          ))}
        </AnimatePresence>
      </section>

      {/* Organizza */}
      <section className="px-4 mb-24">
        <h2 className="font-display text-lg font-semibold mb-3">Organizza un viaggio</h2>
        <div className="space-y-2">
          {[
            { mode: "solo", title: "Avventura Solo", desc: "Percorso AI personalizzato solo per te", emoji: "🎯" },
            { mode: "group", title: "Gruppo", desc: "Gioca con amici, sfida cooperativa", emoji: "👥" },
            { mode: "open", title: "Sessione Aperta", desc: "Matchmaking con altri player in città", emoji: "🌍" },
          ].map((m) => (
            <Card
              key={m.mode}
              onClick={() => searchQuery.trim() ? goToCity(searchQuery, m.mode) : inputRef.current?.focus()}
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
