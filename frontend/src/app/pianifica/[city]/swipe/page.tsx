"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Heart, X, Star, Clock, Wallet, ChevronRight } from "lucide-react";
import { useStore, RankedPOI } from "@/lib/store";

const CATEGORY_GRADIENT: Record<string, string> = {
  museum: "from-purple-900 to-purple-700",
  monument: "from-amber-900 to-amber-700",
  church: "from-blue-900 to-blue-700",
  restaurant: "from-red-900 to-red-700",
  park: "from-green-900 to-green-700",
  attraction: "from-pink-900 to-pink-700",
  viewpoint: "from-sky-900 to-sky-700",
  theatre: "from-violet-900 to-violet-700",
  castle: "from-yellow-900 to-yellow-700",
  archaeological_site: "from-orange-900 to-orange-700",
};

const CATEGORY_EMOJI: Record<string, string> = {
  museum: "🏛️", monument: "🗿", church: "⛪", restaurant: "🍽️",
  park: "🌿", attraction: "🎯", viewpoint: "👁️", theatre: "🎭",
  castle: "🏰", archaeological_site: "🏺",
};

export default function SwipePoisPage() {
  const params = useParams();
  const city = decodeURIComponent(params.city as string);
  const router = useRouter();
  const { trip, setTrip } = useStore();

  const [cards, setCards] = useState<RankedPOI[]>([]);
  const [likedPois, setLikedPois] = useState<RankedPOI[]>([]);
  const [lastAction, setLastAction] = useState<"like" | "nope" | null>(null);

  useEffect(() => {
    if (!trip.tripProfile) {
      router.replace(`/pianifica/${encodeURIComponent(city)}`);
      return;
    }
    if (trip.rankedPois.length === 0) {
      router.replace(`/pianifica/${encodeURIComponent(city)}/pois`);
      return;
    }
    // Deduplicate by id before showing cards
    const seen = new Set<string>();
    const unique = trip.rankedPois.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    setCards(unique);
  }, []);

  const handleSwipe = useCallback(
    (direction: "left" | "right") => {
      const liked = direction === "right";
      const current = cards[0];
      if (!current) return;

      setLastAction(liked ? "like" : "nope");

      if (liked) {
        setLikedPois((prev) => [...prev, current]);
      }

      setTimeout(() => {
        setCards((prev) => prev.slice(1));
        setLastAction(null);
      }, 200);
    },
    [cards]
  );

  const handleFinish = () => {
    setTrip({ likedPois });
    router.push(`/pianifica/${encodeURIComponent(city)}/itinerario`);
  };

  const done = cards.length === 0;
  const total = trip.rankedPois.length;
  const seen = total - cards.length;
  const progress = total > 0 ? (seen / total) * 100 : 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-4 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full glass flex items-center justify-center"
          >
            <X size={18} />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-lg font-bold">Scegli i tuoi posti</h1>
            <p className="text-white/50 text-xs">{city} · {seen}/{total} visti</p>
          </div>
          <span className="text-xs glass px-3 py-1 rounded-full text-green-300">
            {likedPois.length} scelti
          </span>
        </div>

        {/* Progress */}
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-green-400 rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </header>

      {/* Card Stack */}
      <div className="flex-1 flex flex-col items-center justify-start px-4 pt-2">
        {!done ? (
          <>
            <div className="relative w-full" style={{ height: 460 }}>
              <AnimatePresence>
                {cards.slice(0, 3).map((poi, i) => (
                  <SwipeCard
                    key={poi.id}
                    poi={poi}
                    index={i}
                    onSwipe={i === 0 ? handleSwipe : undefined}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Buttons */}
            <div className="flex justify-center gap-6 mt-6">
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => handleSwipe("left")}
                className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center"
              >
                <X size={28} className="text-red-400" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => handleSwipe("right")}
                className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center"
              >
                <Heart size={28} className="text-green-400" />
              </motion.button>
            </div>

            <p className="text-xs text-white/30 mt-3">
              Swipa a destra per scegliere, sinistra per saltare
            </p>
          </>
        ) : (
          /* Completion screen */
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center px-6 pt-12"
          >
            <span className="text-6xl mb-4">
              {likedPois.length > 0 ? "🎉" : "🤔"}
            </span>
            <h2 className="font-display text-2xl font-bold mb-2">
              {likedPois.length > 0 ? "Ottima selezione!" : "Nessun posto scelto"}
            </h2>
            <p className="text-white/60 mb-2">
              Hai scelto <span className="text-white font-semibold">{likedPois.length} posti</span> da visitare a {city}
            </p>
            {likedPois.length === 0 && (
              <p className="text-white/40 text-sm mb-4">
                Torna indietro per rivedere i posti consigliati
              </p>
            )}

            {likedPois.length > 0 && (
              <div className="w-full space-y-2 mb-6 text-left mt-4">
                {likedPois.map((p) => (
                  <div key={p.id} className="glass rounded-xl px-4 py-2.5 flex items-center gap-3">
                    <span>{CATEGORY_EMOJI[p.category] ?? "📍"}</span>
                    <span className="text-sm font-medium">{p.name}</span>
                    {p.hidden_gem && <Star size={12} className="text-yellow-400 ml-auto" />}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* CTA when done */}
      {done && likedPois.length > 0 && (
        <div className="px-4 pb-8">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleFinish}
            className="w-full py-4 rounded-2xl font-semibold bg-primary text-white flex items-center justify-center gap-2"
          >
            Genera il tuo itinerario <ChevronRight size={18} />
          </motion.button>
        </div>
      )}

      {done && likedPois.length === 0 && (
        <div className="px-4 pb-8">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => router.back()}
            className="w-full py-4 rounded-2xl font-semibold glass text-white"
          >
            Torna ai posti consigliati
          </motion.button>
        </div>
      )}

      {/* Feedback overlay */}
      <AnimatePresence>
        {lastAction && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-1/3 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <span className="text-6xl">
              {lastAction === "like" ? "❤️" : "👋"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SwipeCard({
  poi,
  index,
  onSwipe,
}: {
  poi: RankedPOI;
  index: number;
  onSwipe?: (dir: "left" | "right") => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(x, [0, 80], [0, 1]);
  const nopeOpacity = useTransform(x, [-80, 0], [1, 0]);

  const gradient = CATEGORY_GRADIENT[poi.category] ?? "from-gray-900 to-gray-700";

  return (
    <motion.div
      style={{
        x: index === 0 ? x : 0,
        rotate: index === 0 ? rotate : 0,
        zIndex: 10 - index,
        scale: 1 - index * 0.04,
        y: index * 10,
      }}
      drag={index === 0 ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 90) onSwipe?.("right");
        else if (info.offset.x < -90) onSwipe?.("left");
      }}
      exit={{ x: 320, opacity: 0, transition: { duration: 0.2 } }}
      className="absolute inset-0 rounded-3xl overflow-hidden cursor-grab active:cursor-grabbing"
    >
      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />

      {/* Pattern overlay */}
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      />

      {/* Big emoji center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-8xl opacity-20">{CATEGORY_EMOJI[poi.category] ?? "🗺️"}</span>
      </div>

      {/* Like/Nope overlays */}
      {index === 0 && (
        <>
          <motion.div
            style={{ opacity: likeOpacity }}
            className="absolute top-8 left-8 px-4 py-2 border-4 border-green-400 rounded-xl rotate-[-15deg]"
          >
            <span className="text-green-400 font-bold text-2xl">SI</span>
          </motion.div>
          <motion.div
            style={{ opacity: nopeOpacity }}
            className="absolute top-8 right-8 px-4 py-2 border-4 border-red-400 rounded-xl rotate-[15deg]"
          >
            <span className="text-red-400 font-bold text-2xl">NO</span>
          </motion.div>
        </>
      )}

      {/* Hidden gem badge */}
      {poi.hidden_gem && (
        <div className="absolute top-4 right-4 glass rounded-full px-3 py-1 flex items-center gap-1">
          <Star size={12} className="text-yellow-400" />
          <span className="text-xs font-medium">Hidden Gem</span>
        </div>
      )}

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs glass px-2 py-0.5 rounded-full">
            {CATEGORY_EMOJI[poi.category]} {poi.category}
          </span>
          <span className="text-xs text-white/50 flex items-center gap-1">
            <Wallet size={10} /> {poi.estimated_cost}
          </span>
          <span className="text-xs text-white/50 flex items-center gap-1">
            <Clock size={10} /> {poi.estimated_duration ?? 45} min
          </span>
        </div>
        <h3 className="font-display text-2xl font-bold mb-1">{poi.name}</h3>
        {poi.why_for_you && (
          <p className="text-sm text-primary-light italic mb-1">"{poi.why_for_you}"</p>
        )}
        <p className="text-sm text-white/70 line-clamp-2">{poi.description}</p>
      </div>
    </motion.div>
  );
}
