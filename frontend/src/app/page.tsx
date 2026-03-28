"use client";

import { apiGet } from "@/lib/api";
import { useStore } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import {
    ChevronRight,
    MapPin,
    Search,
    Shield,
    Users,
    Zap
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

const ICON_MAP: Record<string, typeof Zap> = {
  Zap: Zap,
  Shield: Shield,
  MapPin: MapPin,
};

interface Action {
  type: string;
  text: string;
  icon: string;
  color: string;
  href?: string;
}

interface TripSummary {
  id: string;
  city: string;
  city_slug: string;
  status: string;
  progress: number;
  created_at?: string;
  stops_count?: number;
}

const CITY_EMOJIS: Record<string, string> = {
  Roma: "🏛️", Firenze: "⛪", Venezia: "🚤", Napoli: "🍕", Milano: "🏙️", Bologna: "🎻",
};

export default function HomePage() {
  const router = useRouter();
  const { user, isHydrated, token, reset } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [actions, setActions] = useState<Action[]>([]);
  const [loadingActions, setLoadingActions] = useState(true);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
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

  // Load user actions from backend
  useEffect(() => {
    const fetchActions = async () => {
      try {
        const response = await apiGet<{ actions: Action[] }>(
          "/api/game/user/actions",
          token || undefined
        );
        // Add default hrefs if not present
        const actionsWithHrefs = (response.actions || []).map((action: Action) => ({
          ...action,
          href: action.type === "new_quiz" ? "/quiz-live" : "/scopri"
        }));
        setActions(actionsWithHrefs);
      } catch (error) {
        console.error("Failed to load actions:", error);
        const msg = (error as Error).message || "";
        if (msg.includes("API 401")) {
          reset();
          router.replace("/auth");
          return;
        }
        // Fallback to default action
        setActions([{
          type: "new_quiz",
          text: "Scopri nuove sfide",
          icon: "Zap",
          color: "bg-blue-500/20",
          href: "/quiz-live"
        }]);
      } finally {
        setLoadingActions(false);
      }
    };

    if (isHydrated && user) {
      fetchActions();
    }
  }, [isHydrated, user, token]);

  // Load trips
  useEffect(() => {
    const fetchTrips = async () => {
      try {
        if (!token) {
          setTrips([]);
          setLoadingTrips(false);
          return;
        }
        const response = await apiGet<{ trips: TripSummary[] }>("/api/game/user/trips", token || undefined);
        setTrips(response.trips || []);
      } catch (error) {
        console.error("Failed to load trips:", error);
        const msg = (error as Error).message || "";
        if (msg.includes("API 401")) {
          reset();
          router.replace("/auth");
          return;
        }
        setTrips([]);
      } finally {
        setLoadingTrips(false);
      }
    };

    if (isHydrated && user) fetchTrips();
  }, [isHydrated, user, token]);

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
          <div className="flex">
            <button
              onClick={() => router.push("/profilo")}
              className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center"
            >
              <Users size={18} className="text-primary-light" />
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

      {/* I tuoi viaggi */}
      <section className="px-4 mb-6">
        <h2 className="font-display text-lg font-semibold mb-3">I tuoi viaggi</h2>
        {loadingTrips ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : trips.length === 0 ? (
          <div className="glass rounded-2xl p-4 text-sm text-white/60">
            Nessun viaggio. Aggiungi una città per iniziare!
          </div>
        ) : (
          <div className="space-y-3">
            {trips.map((trip, i) => (
              <motion.button
                key={trip.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => router.push(`/viaggi/${trip.id}`)}
                className="w-full text-left glass rounded-2xl p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{CITY_EMOJIS[trip.city] ?? "🗺️"}</span>
                    <div>
                      <h3 className="font-semibold text-sm">{trip.city}</h3>
                      <p className="text-xs text-white/50 capitalize">{trip.status}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-white/40">{trip.stops_count || 0} tappe</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary-light transition-all"
                      style={{ width: `${trip.progress}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-white/60">{trip.progress}%</span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </section>

      {/* Azioni da fare */}
      <section className="px-4 mb-6">
        <h2 className="font-display text-lg font-semibold mb-3">Azioni da fare</h2>
        {loadingActions ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <AnimatePresence>
            {actions.map((action, i) => {
              const IconComponent = ICON_MAP[action.icon] || MapPin;
              let href = "/scopri";
              
              // Route actions to appropriate pages
              if (action.type === "territories") {
                href = "/territorio";
              } else if (action.type === "defend_completed") {
                href = "/territorio";
              } else if (action.type === "nearby_cities") {
                href = "/scopri";
              } else if (action.type === "future_quizzes") {
                href = "/quiz-live";
              }
              
              return (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => router.push(href)}
                  className="w-full glass rounded-xl p-3 mb-2 flex items-center gap-3 hover:bg-white/20 transition-colors"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${action.color}`}>
                    <IconComponent size={14} />
                  </div>
                  <span className="text-sm flex-1 text-left">{action.text}</span>
                  <ChevronRight size={16} className="text-white/30 flex-shrink-0" />
                </motion.button>
              );
            })}
          </AnimatePresence>
        )}
      </section>

      {/* <BottomNav /> */}
    </div>
  );
}
