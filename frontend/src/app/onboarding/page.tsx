"use client";

import { apiPost } from "@/lib/api";
import { useStore } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Question {
  id: number;
  text: string;
  options: { label: string; value: string; emoji: string }[];
}

const QUESTIONS: Question[] = [
  {
    id: 1,
    text: "Sei a Roma per un pomeriggio. Scegli:",
    options: [
      { label: "Colosseo", value: "storia", emoji: "🏛️" },
      { label: "Trastevere", value: "nightlife", emoji: "🍷" },
      { label: "Villa Borghese", value: "natura", emoji: "🌿" },
      { label: "Via del Corso", value: "shopping", emoji: "🛍️" },
    ],
  },
  {
    id: 2,
    text: "Il tuo modo ideale di scoprire un posto:",
    options: [
      { label: "Museo con audioguida", value: "arte", emoji: "🎨" },
      { label: "Perdermi nei vicoli", value: "avventura", emoji: "🗺️" },
      { label: "Tour gastronomico", value: "food", emoji: "🍝" },
      { label: "Punto panoramico", value: "natura", emoji: "📸" },
    ],
  },
  {
    id: 3,
    text: "Quanto conosci la storia italiana?",
    options: [
      { label: "Le basi", value: "casual", emoji: "😊" },
      { label: "Mi appassiona", value: "appassionato", emoji: "📚" },
      { label: "Potrei fare la guida", value: "esperto", emoji: "🎓" },
    ],
  },
  {
    id: 4,
    text: "In viaggio preferisci:",
    options: [
      { label: "Pochi posti, a fondo", value: "slow", emoji: "🐌" },
      { label: "Mix equilibrato", value: "medium", emoji: "⚖️" },
      { label: "Tanti posti, overview", value: "fast", emoji: "⚡" },
    ],
  },
  {
    id: 5,
    text: "Fascia d'età:",
    options: [
      { label: "16-24", value: "16-24", emoji: "🧑" },
      { label: "25-34", value: "25-34", emoji: "👩" },
      { label: "35-50", value: "35-50", emoji: "🧔" },
      { label: "50+", value: "50+", emoji: "👴" },
    ],
  },
  {
    id: 6,
    text: "Un sabato sera ideale:",
    options: [
      { label: "Aperitivo vista città", value: "nightlife", emoji: "🌇" },
      { label: "Concerto o teatro", value: "arte", emoji: "🎭" },
      { label: "Cena tipica locale", value: "food", emoji: "🍽️" },
      { label: "Passeggiata serale", value: "natura", emoji: "🌙" },
    ],
  },
  {
    id: 7,
    text: "Cosa ti attira di più in un borgo?",
    options: [
      { label: "La storia nascosta", value: "storia", emoji: "🏰" },
      { label: "I sapori locali", value: "food", emoji: "🧀" },
      { label: "L'architettura", value: "architettura", emoji: "⛪" },
      { label: "Il paesaggio", value: "natura", emoji: "🏞️" },
    ],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { setProfile } = useStore();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  const question = QUESTIONS[currentQ];
  const progress = ((currentQ + 1) / QUESTIONS.length) * 100;

  const handleAnswer = async (value: string) => {
    const newAnswers = { ...answers, [question.id]: value };
    setAnswers(newAnswers);

    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      // Submit to AI for profile inference
      setLoading(true);
      try {
        const quizData = QUESTIONS.map((q) => ({
          question: q.text,
          answer: newAnswers[q.id] || "",
        }));
        const result = await apiPost<{
          interests: string[];
          cultural_level: string;
          pace: string;
          age_range: string;
        }>("/api/profile/infer", { quiz_answers: quizData, swipe_batch: [] });

        setProfile({
          interests: result.interests,
          culturalLevel: result.cultural_level,
          pace: result.pace,
          ageRange: result.age_range || newAnswers[5] || "",
          language: newAnswers[8] || "it",
        });
      } catch {
        // Fallback: build profile from raw answers
        const interests = Object.values(newAnswers).filter(
          (v) => !["casual", "appassionato", "esperto", "slow", "medium", "fast", "it", "en", "fr", "es"].includes(v) && !v.includes("-")
        );
        setProfile({
          interests: [...new Set(interests)],
          culturalLevel: newAnswers[3] || "casual",
          pace: newAnswers[4] || "medium",
          ageRange: newAnswers[5] || "",
          language: newAnswers[8] || "it",
        });
      }
      setLoading(false);
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-4 pt-12">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-white/50 mb-2">
          <span>Profilo giocatore</span>
          <span>
            {currentQ + 1}/{QUESTIONS.length}
          </span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Timer visual */}
      <motion.div
        key={currentQ}
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: 15, ease: "linear" }}
        className="h-1 bg-primary/30 rounded-full mb-6"
      />

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQ}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
          className="flex-1"
        >
          <h2 className="font-display text-xl font-bold mb-8 text-center">
            {question.text}
          </h2>

          <div className="space-y-3">
            {question.options.map((option) => (
              <motion.button
                key={option.value}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAnswer(option.value)}
                className="w-full glass rounded-2xl p-4 flex items-center gap-4 hover:bg-white/20 transition-colors"
              >
                <span className="text-2xl">{option.emoji}</span>
                <span className="font-medium">{option.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-gray-950/90 flex flex-col items-center justify-center z-50"
        >
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white/70">L&apos;AI sta analizzando il tuo profilo...</p>
        </motion.div>
      )}
    </div>
  );
}
