"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStore, TripProfile } from "@/lib/store";

const INTERESTS = [
  { id: "arte", label: "Arte", emoji: "🎨" },
  { id: "storia", label: "Storia", emoji: "🏛️" },
  { id: "cibo", label: "Cibo & Vino", emoji: "🍷" },
  { id: "natura", label: "Natura", emoji: "🌿" },
  { id: "architettura", label: "Architettura", emoji: "🏗️" },
  { id: "musica", label: "Musica", emoji: "🎵" },
  { id: "shopping", label: "Shopping", emoji: "🛍️" },
  { id: "nightlife", label: "Vita notturna", emoji: "🌙" },
  { id: "sport", label: "Sport & Avventura", emoji: "⛰️" },
  { id: "relax", label: "Relax", emoji: "☕" },
];

type BudgetKey = TripProfile["budget"];
type GroupKey = TripProfile["group"];
type PaceKey = TripProfile["pace"];
type ExpKey = TripProfile["experienceType"];

const STEPS = [
  "Quanti giorni?",
  "Qual è il tuo budget?",
  "Con chi viaggi?",
  "Cosa ti interessa?",
  "Che ritmo preferisci?",
  "Tipo di esperienza?",
];

export default function PianificaPage() {
  const params = useParams();
  const city = decodeURIComponent(params.city as string);
  const router = useRouter();
  const { setTrip } = useStore();

  const [step, setStep] = useState(0);
  const [days, setDays] = useState(2);
  const [budget, setBudget] = useState<BudgetKey>("medio");
  const [group, setGroup] = useState<GroupKey>("solo");
  const [interests, setInterests] = useState<string[]>([]);
  const [pace, setPace] = useState<PaceKey>("medium");
  const [experienceType, setExperienceType] = useState<ExpKey>("mix");

  const progress = ((step + 1) / STEPS.length) * 100;

  const toggleInterest = (id: string) => {
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const canNext = () => {
    if (step === 3 && interests.length === 0) return false;
    return true;
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      const tripProfile: TripProfile = {
        days,
        budget,
        group,
        interests,
        pace,
        experienceType,
      };
      setTrip({ city, tripProfile, rankedPois: [], likedPois: [], itinerary: [] });
      router.push(`/pianifica/${encodeURIComponent(city)}/pois`);
    }
  };

  const handleBack = () => {
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-4 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={handleBack} className="w-10 h-10 rounded-full glass flex items-center justify-center">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1">
            <p className="text-white/50 text-xs">Pianifica viaggio a</p>
            <h1 className="font-display text-lg font-bold">{city}</h1>
          </div>
          <span className="text-xs text-white/40">{step + 1}/{STEPS.length}</span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-primary-light rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </header>

      {/* Question */}
      <div className="flex-1 px-4 pt-6 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25 }}
          >
            <h2 className="font-display text-2xl font-bold mb-6">{STEPS[step]}</h2>

            {/* Step 0: Days */}
            {step === 0 && (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <motion.button
                    key={d}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setDays(d)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                      days === d
                        ? "bg-primary/30 border-2 border-primary"
                        : "glass border-2 border-transparent"
                    }`}
                  >
                    <span className="text-2xl">{["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣"][d-1]}</span>
                    <div className="text-left">
                      <p className="font-semibold">{d === 7 ? "7+ giorni" : `${d} ${d === 1 ? "giorno" : "giorni"}`}</p>
                      <p className="text-xs text-white/50">
                        {d === 1 ? "Gita di un giorno" : d <= 3 ? "Weekend / short break" : d <= 5 ? "Vacanza breve" : "Vacanza lunga"}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}

            {/* Step 1: Budget */}
            {step === 1 && (
              <div className="space-y-3">
                {(
                  [
                    { key: "economico", label: "Economico", sub: "< 50€/giorno", emoji: "🪙" },
                    { key: "medio", label: "Moderato", sub: "50–100€/giorno", emoji: "💳" },
                    { key: "comfort", label: "Comfort", sub: "100–200€/giorno", emoji: "🌟" },
                    { key: "lusso", label: "Lusso", sub: "200€+/giorno", emoji: "💎" },
                  ] as { key: BudgetKey; label: string; sub: string; emoji: string }[]
                ).map((b) => (
                  <motion.button
                    key={b.key}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setBudget(b.key)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                      budget === b.key
                        ? "bg-primary/30 border-2 border-primary"
                        : "glass border-2 border-transparent"
                    }`}
                  >
                    <span className="text-2xl">{b.emoji}</span>
                    <div className="text-left">
                      <p className="font-semibold">{b.label}</p>
                      <p className="text-xs text-white/50">{b.sub}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}

            {/* Step 2: Group */}
            {step === 2 && (
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { key: "solo", label: "Solo", emoji: "🎯" },
                    { key: "coppia", label: "Coppia", emoji: "❤️" },
                    { key: "famiglia", label: "Famiglia", emoji: "👨‍👩‍👧" },
                    { key: "gruppo", label: "Gruppo di amici", emoji: "🎉" },
                  ] as { key: GroupKey; label: string; emoji: string }[]
                ).map((g) => (
                  <motion.button
                    key={g.key}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setGroup(g.key)}
                    className={`flex flex-col items-center gap-3 p-5 rounded-2xl transition-all ${
                      group === g.key
                        ? "bg-primary/30 border-2 border-primary"
                        : "glass border-2 border-transparent"
                    }`}
                  >
                    <span className="text-3xl">{g.emoji}</span>
                    <span className="text-sm font-medium">{g.label}</span>
                  </motion.button>
                ))}
              </div>
            )}

            {/* Step 3: Interests */}
            {step === 3 && (
              <div>
                <p className="text-sm text-white/50 mb-4">Seleziona almeno un interesse</p>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((item) => (
                    <motion.button
                      key={item.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleInterest(item.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                        interests.includes(item.id)
                          ? "bg-primary/40 border-2 border-primary text-white"
                          : "glass border-2 border-white/10 text-white/70"
                      }`}
                    >
                      <span>{item.emoji}</span>
                      <span>{item.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Pace */}
            {step === 4 && (
              <div className="space-y-3">
                {(
                  [
                    { key: "slow", label: "Rilassato", sub: "2–3 posti al giorno, tanto tempo per ognuno", emoji: "🧘" },
                    { key: "medium", label: "Moderato", sub: "4–5 posti al giorno, bilanciato", emoji: "🚶" },
                    { key: "fast", label: "Intenso", sub: "6+ posti al giorno, massimo da vedere", emoji: "🏃" },
                  ] as { key: PaceKey; label: string; sub: string; emoji: string }[]
                ).map((p) => (
                  <motion.button
                    key={p.key}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setPace(p.key)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                      pace === p.key
                        ? "bg-primary/30 border-2 border-primary"
                        : "glass border-2 border-transparent"
                    }`}
                  >
                    <span className="text-2xl">{p.emoji}</span>
                    <div className="text-left">
                      <p className="font-semibold">{p.label}</p>
                      <p className="text-xs text-white/50">{p.sub}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}

            {/* Step 5: Experience type */}
            {step === 5 && (
              <div className="space-y-3">
                {(
                  [
                    { key: "classico", label: "Turista classico", sub: "Classici imperdibili, tappe iconiche", emoji: "🗼" },
                    { key: "esploratore", label: "Esploratore nascosto", sub: "Posti rari, angoli sconosciuti, hidden gem", emoji: "🔍" },
                    { key: "mix", label: "Mix perfetto", sub: "Un po' di tutto, classici e segreti", emoji: "✨" },
                  ] as { key: ExpKey; label: string; sub: string; emoji: string }[]
                ).map((e) => (
                  <motion.button
                    key={e.key}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setExperienceType(e.key)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                      experienceType === e.key
                        ? "bg-primary/30 border-2 border-primary"
                        : "glass border-2 border-transparent"
                    }`}
                  >
                    <span className="text-2xl">{e.emoji}</span>
                    <div className="text-left">
                      <p className="font-semibold">{e.label}</p>
                      <p className="text-xs text-white/50">{e.sub}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* CTA */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-4 bg-gradient-to-t from-black/80 to-transparent">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleNext}
          disabled={!canNext()}
          className={`w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all ${
            canNext()
              ? "bg-primary text-white"
              : "bg-white/10 text-white/30 cursor-not-allowed"
          }`}
        >
          {step < STEPS.length - 1 ? (
            <>Avanti <ChevronRight size={18} /></>
          ) : (
            <>Scopri i posti per te <ChevronRight size={18} /></>
          )}
        </motion.button>
      </div>
    </div>
  );
}
