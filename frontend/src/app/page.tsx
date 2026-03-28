"use client";

import { useStore } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, MapPin, Search, Shield, User, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  "Vicenza", "Viterbo", "Scalea",
];

const CITY_EMOJIS: Record<string, string> = {
  Roma: "🏛️", Firenze: "⛪", Venezia: "🚤", Napoli: "🍕",
  Milano: "🏙️", Bologna: "🎻",
};

const NEARBY_ROMA = ["Tivoli", "Frascati", "Ostia", "Castel Gandolfo"];

export default function HomePage() {
  const router = useRouter();
  const { user, isHydrated, savedItineraries, currentGame } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showNearby, setShowNearby] = useState(false);
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

  const goToNewTrip = (city: string) => {
    setShowSuggestions(false);
    router.push(`/pianifica/${encodeURIComponent(city)}`);
  };

  const goToTrip = (city: string) => {
    router.push(`/viaggio/${encodeURIComponent(city)}`);
  };

  if (!isHydrated || !user) return null;

  // Build "I tuoi viaggi" list
  const activeCity = currentGame?.city ?? null;
  const viaggi: { city: string; status: "attivo" | "futuro"; subtitle: string }[] = [];

  if (activeCity) {
    viaggi.push({
      city: activeCity,
      status: "attivo",
      subtitle: `${currentGame!.stops.filter((s) => s.completed).length}/${currentGame!.stops.length} tappe completate`,
    });
  }

  for (const itin of savedItineraries) {
    if (itin.city === activeCity) continue; // già mostrato come attivo
    viaggi.push({
      city: itin.city,
      status: "futuro",
      subtitle: `${itin.days} giorni · ${itin.likedPoisCount} posti · ${new Date(itin.createdAt).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}`,
    });
  }

  // Azioni
  const completedStops = currentGame?.stops.filter((s) => s.completed).length ?? 0;
  const futureTripCount = savedItineraries.filter((s) => s.city !== activeCity).length;

  const azioni = [
    {
      icon: Shield,
      color: "bg-yellow-500/20 text-yellow-400",
      text: completedStops > 0 ? `${completedStops} posti da difendere` : "I tuoi territori",
      href: "/territorio",
    },
    {
      icon: MapPin,
      color: "bg-green-500/20 text-green-400",
      text: "Città vicine a Roma",
      href: null, // apre inline
    },
    {
      icon: Zap,
      color: "bg-blue-500/20 text-blue-400",
      text: futureTripCount > 0
        ? `${futureTripCount} itinerar${futureTripCount === 1 ? "io" : "i"} futur${futureTripCount === 1 ? "o" : "i"} da preparare`
        : "Prepara il prossimo viaggio",
      href: futureTripCount > 0
        ? `/viaggio/${encodeURIComponent(savedItineraries.find(s => s.city !== activeCity)?.city ?? "")}`
        : null,
    },
  ];

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <header className="px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold">Play The City</h1>
            <p className="text-white/50 text-sm mt-1">Ciao, {user.displayName}</p>
          </div>
          <button
            onClick={() => router.push("/profilo")}
            className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center"
          >
            <User size={18} className="text-primary-light" />
          </button>
        </div>

        {/* Search */}
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
                goToNewTrip(match || searchQuery);
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
                  onMouseDown={() => goToNewTrip(city)}
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
              onClick={() => goToNewTrip(city)}
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
        {viaggi.length === 0 ? (
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-white/50 text-sm mb-3">Nessun viaggio ancora</p>
            <button
              onClick={() => inputRef.current?.focus()}
              className="text-primary text-sm font-medium"
            >
              Pianifica il tuo primo viaggio →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {viaggi.map((v, i) => (
                <motion.button
                  key={`${v.city}-${v.status}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  onClick={() => goToTrip(v.city)}
                  className="w-full glass rounded-2xl p-4 flex items-center gap-4 text-left hover:bg-white/10 transition-colors"
                >
                  <span className="text-3xl">{CITY_EMOJIS[v.city] ?? "🗺️"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-sm">{v.city}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        v.status === "attivo"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}>
                        {v.status === "attivo" ? "In corso" : "Futuro"}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 truncate">{v.subtitle}</p>
                  </div>
                  <ChevronRight size={16} className="text-white/30 flex-shrink-0" />
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* Azioni da fare */}
      <section className="px-4 mb-6">
        <h2 className="font-display text-lg font-semibold mb-3">Azioni da fare</h2>
        <div className="space-y-2">
          {azioni.map((action, i) => {
            const Icon = action.icon;
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <button
                  onClick={() => {
                    if (action.href) {
                      router.push(action.href);
                    } else if (i === 1) {
                      setShowNearby((v) => !v);
                    }
                  }}
                  className="w-full glass rounded-xl p-3 flex items-center gap-3 hover:bg-white/10 transition-colors"
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${action.color}`}>
                    <Icon size={16} />
                  </div>
                  <span className="text-sm flex-1 text-left">{action.text}</span>
                  <ChevronRight size={16} className={`text-white/30 flex-shrink-0 transition-transform ${i === 1 && showNearby ? "rotate-90" : ""}`} />
                </button>

                {/* Città vicine inline */}
                {i === 1 && showNearby && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 ml-3 flex flex-wrap gap-2"
                  >
                    {NEARBY_ROMA.map((city) => (
                      <button
                        key={city}
                        onClick={() => goToNewTrip(city)}
                        className="glass rounded-xl px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 transition-colors"
                      >
                        {city}
                      </button>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
