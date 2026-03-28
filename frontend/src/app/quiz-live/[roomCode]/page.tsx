"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "next/navigation";
import { Trophy, Clock, Users, Zap } from "lucide-react";
import { Button } from "@/components/UI/Button";

const MOCK_QUESTIONS = [
  { question: "In che anno fu completato il Colosseo?", options: ["80 d.C.", "100 d.C.", "50 d.C.", "120 d.C."], correct_index: 0 },
  { question: "Chi progettò la fontana dei Quattro Fiumi in Piazza Navona?", options: ["Borromini", "Bernini", "Michelangelo", "Bramante"], correct_index: 1 },
  { question: "Quale materiale fu usato per la cupola del Pantheon?", options: ["Marmo", "Calcestruzzo romano", "Granito", "Tufo"], correct_index: 1 },
  { question: "Quanti gradini ha la scalinata di Trinità dei Monti?", options: ["100", "135", "150", "120"], correct_index: 1 },
  { question: "In quale colle si trova il Giardino degli Aranci?", options: ["Palatino", "Aventino", "Esquilino", "Celio"], correct_index: 1 },
];

const MOCK_PLAYERS = [
  { id: "1", name: "Marco_Roma", score: 0 },
  { id: "2", name: "SarahExplorer", score: 0 },
  { id: "3", name: "Tu", score: 0 },
];

export default function QuizRoomPage() {
  const params = useParams();
  const roomCode = params.roomCode as string;

  const [phase, setPhase] = useState<"lobby" | "playing" | "results">("lobby");
  const [currentQ, setCurrentQ] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [timer, setTimer] = useState(15);
  const [scores, setScores] = useState(MOCK_PLAYERS.map((p) => ({ ...p })));
  const [streak, setStreak] = useState(0);

  const question = MOCK_QUESTIONS[currentQ];

  // Timer countdown
  useEffect(() => {
    if (phase !== "playing" || answer !== null) return;
    if (timer <= 0) {
      handleAnswer(-1);
      return;
    }
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer, phase, answer]);

  const handleAnswer = useCallback(
    (idx: number) => {
      if (answer !== null) return;
      setAnswer(idx);

      const correct = idx === question.correct_index;
      if (correct) {
        const points = Math.max(10, 100 - (15 - timer) * 6);
        setScores((prev) =>
          prev.map((p) =>
            p.id === "3" ? { ...p, score: p.score + points } : p
          )
        );
        setStreak((s) => s + 1);
      } else {
        setStreak(0);
      }

      // Simulate other players
      setScores((prev) =>
        prev.map((p) => {
          if (p.id === "3") return p;
          const otherCorrect = Math.random() > 0.4;
          return otherCorrect
            ? { ...p, score: p.score + Math.floor(Math.random() * 80 + 20) }
            : p;
        })
      );

      // Next question after delay
      setTimeout(() => {
        if (currentQ < MOCK_QUESTIONS.length - 1) {
          setCurrentQ((q) => q + 1);
          setAnswer(null);
          setTimer(15);
        } else {
          setPhase("results");
        }
      }, 2000);
    },
    [answer, currentQ, timer, question]
  );

  // Lobby
  if (phase === "lobby") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="glass rounded-2xl p-6 w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Zap size={28} className="text-primary-light" />
          </div>
          <h1 className="font-display text-2xl font-bold mb-1">Quiz Live</h1>
          <p className="font-mono text-2xl tracking-widest text-primary-light mb-4">
            {roomCode}
          </p>
          <div className="flex items-center justify-center gap-2 text-white/60 mb-6">
            <Users size={16} />
            <span>{scores.length} giocatori connessi</span>
          </div>
          <div className="space-y-2 mb-6">
            {scores.map((p) => (
              <div key={p.id} className="glass rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center text-sm">
                  {p.name[0]}
                </div>
                <span className="text-sm font-medium">{p.name}</span>
                {p.id === "3" && (
                  <span className="text-[10px] bg-primary/20 text-primary-light px-2 py-0.5 rounded-full ml-auto">
                    Tu
                  </span>
                )}
              </div>
            ))}
          </div>
          <Button onClick={() => setPhase("playing")} className="w-full">
            Inizia Quiz
          </Button>
        </div>
      </div>
    );
  }

  // Results
  if (phase === "results") {
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass rounded-2xl p-6 w-full max-w-sm text-center"
        >
          <span className="text-5xl mb-4 block">🏆</span>
          <h1 className="font-display text-2xl font-bold mb-6">Risultati</h1>
          <div className="space-y-3 mb-6">
            {sorted.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.15 }}
                className={`rounded-xl p-4 flex items-center gap-3 ${
                  i === 0 ? "bg-yellow-500/20 border border-yellow-500/30" : "glass"
                }`}
              >
                <span className="text-lg font-bold text-white/60 w-6">
                  {i + 1}.
                </span>
                <span className="font-semibold flex-1 text-left">{p.name}</span>
                <span className="font-mono font-bold text-lg">
                  {p.score}
                </span>
              </motion.div>
            ))}
          </div>
          <p className="text-sm text-white/50 mb-4">
            +{scores.find((p) => p.id === "3")?.score || 0} monete guadagnate
          </p>
          <Button onClick={() => window.location.href = "/"} className="w-full">
            Torna alla Home
          </Button>
        </motion.div>
      </div>
    );
  }

  // Playing
  return (
    <div className="min-h-screen flex flex-col px-4 pt-8">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm text-white/50">
          {currentQ + 1}/{MOCK_QUESTIONS.length}
        </span>
        <div className="flex items-center gap-2">
          {streak > 1 && (
            <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full">
              🔥 x{streak}
            </span>
          )}
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              timer <= 5 ? "bg-red-500/20 text-red-400" : "glass"
            }`}
          >
            {timer}
          </div>
        </div>
      </div>

      {/* Timer bar */}
      <div className="h-1 bg-white/10 rounded-full mb-8 overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          animate={{ width: `${(timer / 15) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQ}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="flex-1"
        >
          <h2 className="font-display text-xl font-bold text-center mb-8">
            {question.question}
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {question.options.map((opt, i) => {
              const colors = [
                "from-red-500/30 to-red-600/10 border-red-500/30",
                "from-blue-500/30 to-blue-600/10 border-blue-500/30",
                "from-yellow-500/30 to-yellow-600/10 border-yellow-500/30",
                "from-green-500/30 to-green-600/10 border-green-500/30",
              ];
              const isCorrect = i === question.correct_index;
              const isSelected = answer === i;

              return (
                <motion.button
                  key={i}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleAnswer(i)}
                  disabled={answer !== null}
                  className={`p-4 rounded-2xl border text-sm font-medium transition-all ${
                    answer !== null
                      ? isCorrect
                        ? "bg-green-500/30 border-green-500"
                        : isSelected
                        ? "bg-red-500/30 border-red-500"
                        : "opacity-40 " + `bg-gradient-to-br ${colors[i]}`
                      : `bg-gradient-to-br ${colors[i]} hover:scale-105`
                  }`}
                >
                  {opt}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Live scores */}
      <div className="mt-6 mb-4">
        <div className="flex gap-2 justify-center">
          {[...scores]
            .sort((a, b) => b.score - a.score)
            .map((p) => (
              <div
                key={p.id}
                className={`glass rounded-xl px-3 py-2 text-center ${
                  p.id === "3" ? "border border-primary/30" : ""
                }`}
              >
                <p className="text-xs font-medium">{p.name}</p>
                <p className="font-mono font-bold">{p.score}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
