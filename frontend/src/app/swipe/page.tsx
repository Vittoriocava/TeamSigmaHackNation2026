"use client";

import { useState, useCallback } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Heart, X, MapPin, Star, Clock } from "lucide-react";
import { BottomNav } from "@/components/UI/BottomNav";

interface PlaceCard {
  id: string;
  name: string;
  category: string;
  image: string;
  city: string;
  description: string;
  hidden_gem: boolean;
}

const MOCK_PLACES: PlaceCard[] = [
  { id: "1", name: "Pantheon", category: "storia", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Rome-Pantheon-Interieur1.jpg/800px-Rome-Pantheon-Interieur1.jpg", city: "Roma", description: "Il tempio meglio conservato dell'antica Roma, con la cupola più grande del mondo in calcestruzzo non armato.", hidden_gem: false },
  { id: "2", name: "Quartiere Coppedè", category: "architettura", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Quartiere_Coppede_-_Roma.jpg/800px-Quartiere_Coppede_-_Roma.jpg", city: "Roma", description: "Un quartiere nascosto con architettura liberty e art déco. Sembra di entrare in un mondo parallelo.", hidden_gem: true },
  { id: "3", name: "Trastevere", category: "nightlife", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Roma-trastevere01.jpg/800px-Roma-trastevere01.jpg", city: "Roma", description: "Il cuore bohémien di Roma. Vicoli, osterie, arte di strada e la vera vita notturna romana.", hidden_gem: false },
  { id: "4", name: "Orto Botanico", category: "natura", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Roma-orto_botanico01.jpg/800px-Roma-orto_botanico01.jpg", city: "Roma", description: "12 ettari di verde nascosti dietro Trastevere. Giardino giapponese, serra tropicale, roseto antico.", hidden_gem: true },
  { id: "5", name: "Mercato di Testaccio", category: "food", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Nuovo_Mercato_di_Testaccio_01.JPG/800px-Nuovo_Mercato_di_Testaccio_01.JPG", city: "Roma", description: "Il vero mercato dei romani. Supplì perfetti, pasta fresca, street food autentico lontano dai turisti.", hidden_gem: true },
];

export default function SwipePage() {
  const [cards, setCards] = useState(MOCK_PLACES);
  const [swipeCount, setSwipeCount] = useState(0);
  const [lastAction, setLastAction] = useState<"like" | "nope" | null>(null);

  const handleSwipe = useCallback(
    (direction: "left" | "right") => {
      const liked = direction === "right";
      setLastAction(liked ? "like" : "nope");
      setSwipeCount((c) => c + 1);

      // TODO: apiPost('/api/profile/swipe', { poi_id: cards[0].id, liked })

      setTimeout(() => {
        setCards((prev) => prev.slice(1));
        setLastAction(null);
      }, 200);
    },
    [cards]
  );

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="px-4 pt-12 pb-2">
        <h1 className="font-display text-xl font-bold text-center">
          Tinder dei Posti
        </h1>
        <p className="text-white/50 text-sm text-center mt-1">
          Swipe per affinare il tuo profilo
        </p>
        <div className="flex justify-center gap-2 mt-3">
          <span className="text-xs glass px-3 py-1 rounded-full">
            {swipeCount} swipe
          </span>
        </div>
      </header>

      {/* Card Stack */}
      <div className="relative h-[480px] mx-4 mt-4">
        <AnimatePresence>
          {cards.slice(0, 3).map((card, i) => (
            <SwipeCard
              key={card.id}
              card={card}
              index={i}
              onSwipe={i === 0 ? handleSwipe : undefined}
            />
          ))}
        </AnimatePresence>

        {cards.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl mb-4">🎉</span>
            <p className="font-semibold">Hai visto tutti i posti!</p>
            <p className="text-sm text-white/50 mt-1">
              Il tuo profilo è stato aggiornato
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {cards.length > 0 && (
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
      )}

      {/* Feedback overlay */}
      <AnimatePresence>
        {lastAction && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-1/3 left-1/2 -translate-x-1/2 z-50"
          >
            <span className="text-6xl">
              {lastAction === "like" ? "❤️" : "👋"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}

function SwipeCard({
  card,
  index,
  onSwipe,
}: {
  card: PlaceCard;
  index: number;
  onSwipe?: (dir: "left" | "right") => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

  return (
    <motion.div
      style={{
        x: index === 0 ? x : 0,
        rotate: index === 0 ? rotate : 0,
        zIndex: 10 - index,
        scale: 1 - index * 0.05,
        y: index * 8,
      }}
      drag={index === 0 ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 100) onSwipe?.("right");
        else if (info.offset.x < -100) onSwipe?.("left");
      }}
      exit={{ x: 300, opacity: 0, transition: { duration: 0.2 } }}
      className="absolute inset-0 rounded-3xl overflow-hidden cursor-grab active:cursor-grabbing"
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${card.image})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

      {/* Like/Nope overlays */}
      {index === 0 && (
        <>
          <motion.div
            style={{ opacity: likeOpacity }}
            className="absolute top-8 left-8 px-4 py-2 border-4 border-green-400 rounded-xl rotate-[-15deg]"
          >
            <span className="text-green-400 font-bold text-2xl">LIKE</span>
          </motion.div>
          <motion.div
            style={{ opacity: nopeOpacity }}
            className="absolute top-8 right-8 px-4 py-2 border-4 border-red-400 rounded-xl rotate-[15deg]"
          >
            <span className="text-red-400 font-bold text-2xl">NOPE</span>
          </motion.div>
        </>
      )}

      {/* Hidden gem badge */}
      {card.hidden_gem && (
        <div className="absolute top-4 right-4 glass rounded-full px-3 py-1 flex items-center gap-1">
          <Star size={12} className="text-yellow-400" />
          <span className="text-xs font-medium">Hidden Gem</span>
        </div>
      )}

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="flex items-center gap-2 mb-1">
          <MapPin size={14} className="text-primary-light" />
          <span className="text-xs text-white/60">{card.city}</span>
          <span className="text-xs glass px-2 py-0.5 rounded-full">
            {card.category}
          </span>
        </div>
        <h3 className="font-display text-2xl font-bold mb-2">{card.name}</h3>
        <p className="text-sm text-white/70 line-clamp-2">
          {card.description}
        </p>
      </div>
    </motion.div>
  );
}
