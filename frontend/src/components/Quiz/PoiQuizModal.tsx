"use client";

import { apiGet, apiPost } from "@/lib/api";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, X, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: string;
}

interface PlayResponse {
  poi_id: string;
  poi_name: string;
  questions: QuizQuestion[];
  pieces_owned: number;
}

interface SubmitResponse {
  piece_earned: boolean;
  pieces_total: number;
  correct: number;
  total: number;
}

interface Props {
  poiId: string;
  poiName: string;
  poiDescription?: string;
  city: string;
  token: string | null;
  onClose: (newPiecesTotal?: number) => void;
}

type Phase = "loading" | "playing" | "result" | "error";

export function PoiQuizModal({ poiId, poiName, poiDescription, city, token, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [piecesOwned, setPiecesOwned] = useState(0);
  const [currentQ, setCurrentQ] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadQuiz();
    return () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadQuiz = async () => {
    try {
      const data = await apiPost<PlayResponse>(
        `/api/quiz/poi/${encodeURIComponent(poiId)}/play`,
        { poi_name: poiName, poi_description: poiDescription ?? "", city },
        token ?? undefined,
        60000,
      );
      setQuestions(data.questions);
      setPiecesOwned(data.pieces_owned);
      setPhase("playing");
    } catch {
      setErrorMsg("Impossibile caricare il quiz. Riprova.");
      setPhase("error");
    }
  };

  const handleSelect = (idx: number) => {
    if (selectedAnswer !== null || showFeedback) return;
    setSelectedAnswer(idx);
    setShowFeedback(true);
    const isCorrect = idx === questions[currentQ].correct_index;
    if (isCorrect) setCorrectCount((c) => c + 1);

    feedbackTimer.current = setTimeout(async () => {
      setShowFeedback(false);
      setSelectedAnswer(null);
      if (currentQ < questions.length - 1) {
        setCurrentQ((q) => q + 1);
      } else {
        // All questions answered — submit
        const finalCorrect = isCorrect ? correctCount + 1 : correctCount;
        try {
          const res = await apiPost<SubmitResponse>(
            `/api/quiz/poi/${encodeURIComponent(poiId)}/submit`,
            { poi_name: poiName, city, correct: finalCorrect, total: questions.length },
            token ?? undefined,
          );
          setResult(res);
        } catch {
          setResult({
            piece_earned: false,
            pieces_total: piecesOwned,
            correct: finalCorrect,
            total: questions.length,
          });
        }
        setPhase("result");
      }
    }, 1400);
  };

  const q = questions[currentQ];
  const progress = ((currentQ + (showFeedback ? 1 : 0)) / questions.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(result?.pieces_total); }}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="bg-[#0f0f1a] rounded-t-3xl max-h-[92vh] overflow-y-auto"
      >
        {/* Handle + header */}
        <div className="px-4 pt-3 pb-4 border-b border-white/8">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-white/40 uppercase tracking-wider">Quiz</p>
              <h2 className="font-display font-bold text-base truncate max-w-[260px]">{poiName}</h2>
            </div>
            <button
              onClick={() => onClose(result?.pieces_total)}
              className="glass rounded-full p-2"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="px-4 pt-5 pb-10">
          {/* LOADING */}
          {phase === "loading" && (
            <div className="flex flex-col items-center py-16 gap-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent"
              />
              <p className="text-sm text-white/50">Genero le domande con l&apos;AI...</p>
            </div>
          )}

          {/* ERROR */}
          {phase === "error" && (
            <div className="flex flex-col items-center py-12 gap-4 text-center">
              <XCircle size={40} className="text-red-400" />
              <p className="text-sm text-white/60">{errorMsg}</p>
              <button
                onClick={() => { setPhase("loading"); loadQuiz(); }}
                className="glass px-6 py-2.5 rounded-xl text-sm font-semibold"
              >
                Riprova
              </button>
            </div>
          )}

          {/* PLAYING */}
          {phase === "playing" && q && (
            <div>
              {/* Progress bar */}
              <div className="flex gap-1 mb-5">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-all duration-400 ${
                      i < currentQ ? "bg-primary" : i === currentQ ? "bg-primary/50 animate-pulse" : "bg-white/10"
                    }`}
                  />
                ))}
              </div>

              {/* Question counter */}
              <p className="text-[11px] text-white/40 mb-2">
                Domanda {currentQ + 1} di {questions.length} ·{" "}
                <span className={`font-medium ${
                  q.difficulty === "easy" ? "text-green-400" :
                  q.difficulty === "hard" ? "text-red-400" : "text-yellow-400"
                }`}>
                  {q.difficulty === "easy" ? "Facile" : q.difficulty === "hard" ? "Difficile" : "Medio"}
                </span>
              </p>

              {/* Question */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQ}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.18 }}
                >
                  <p className="font-semibold text-base leading-snug mb-5">{q.question}</p>

                  <div className="space-y-2.5">
                    {q.options.map((opt, i) => {
                      let style = "glass border border-white/10 text-white/80 hover:bg-white/10";
                      if (showFeedback) {
                        if (i === q.correct_index) style = "bg-green-500/20 border border-green-500/50 text-green-300";
                        else if (i === selectedAnswer) style = "bg-red-500/20 border border-red-500/50 text-red-300";
                        else style = "glass border border-white/5 text-white/30";
                      }
                      return (
                        <motion.button
                          key={i}
                          whileTap={!showFeedback ? { scale: 0.98 } : undefined}
                          onClick={() => handleSelect(i)}
                          disabled={showFeedback}
                          className={`w-full text-left px-4 py-3.5 rounded-2xl text-sm font-medium transition-all ${style}`}
                        >
                          <span className="text-white/40 mr-2 font-mono text-xs">
                            {String.fromCharCode(65 + i)}.
                          </span>
                          {opt}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Explanation (shown after answer) */}
                  {showFeedback && q.explanation && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 glass rounded-2xl px-4 py-3"
                    >
                      <p className="text-xs text-white/60 leading-relaxed">{q.explanation}</p>
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* RESULT */}
          {phase === "result" && result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              {/* Score */}
              <div className="mb-6">
                <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
                  result.piece_earned ? "bg-primary/30 border-2 border-primary" : "bg-white/10 border-2 border-white/20"
                }`}>
                  <span className="text-3xl font-display font-black">
                    {result.correct}/{result.total}
                  </span>
                </div>
                <p className="font-display text-lg font-bold mb-1">
                  {result.correct >= 4 ? "Ottimo!" : result.correct >= 3 ? "Bravo!" : "Ci riprovi?"}
                </p>
                <p className="text-sm text-white/50">
                  {result.correct} risposta{result.correct !== 1 ? "e" : ""} corretta{result.correct !== 1 ? "" : ""}
                  {result.correct !== 1 ? " corrette" : ""}
                  {" su "}{result.total}
                </p>
              </div>

              {/* Piece status */}
              <div className={`glass rounded-2xl p-5 mb-6 ${result.piece_earned ? "border border-primary/40" : ""}`}>
                {result.piece_earned ? (
                  <div>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.2 }}
                      className="text-4xl mb-2"
                    >
                      🧩
                    </motion.div>
                    <p className="font-semibold text-sm text-primary-light mb-1">Pezzo conquistato!</p>
                    <p className="text-xs text-white/40">
                      Hai {result.pieces_total}/3 pezzi di {poiName}
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="text-3xl mb-2">😤</div>
                    <p className="font-semibold text-sm mb-1">Nessun pezzo questa volta</p>
                    <p className="text-xs text-white/40">Servono almeno 3 risposte corrette su 5</p>
                  </div>
                )}

                {/* Pieces display */}
                <div className="flex justify-center gap-2 mt-4">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: i < result.pieces_total ? 0.5 : 1 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.1 + 0.3 }}
                      className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center ${
                        i < result.pieces_total
                          ? "bg-primary/30 border-primary text-primary-light"
                          : "bg-white/5 border-white/20 text-white/20"
                      }`}
                    >
                      {i < result.pieces_total ? "🧩" : <span className="text-lg">·</span>}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                {result.pieces_total < 3 ? (
                  <>
                    <button
                      onClick={() => {
                        setPhase("loading");
                        setCurrentQ(0);
                        setCorrectCount(0);
                        setSelectedAnswer(null);
                        setShowFeedback(false);
                        setResult(null);
                        setPiecesOwned(result.pieces_total);
                        loadQuiz();
                      }}
                      className="flex-1 bg-primary text-white py-3.5 rounded-2xl text-sm font-bold"
                    >
                      Rifai il quiz 🔄
                    </button>
                    <button
                      onClick={() => onClose(result.pieces_total)}
                      className="glass py-3.5 px-5 rounded-2xl text-sm font-medium"
                    >
                      Chiudi
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onClose(result.pieces_total)}
                    className="w-full bg-primary text-white py-3.5 rounded-2xl text-sm font-bold"
                  >
                    3/3 Pezzi collezionati! 🎉
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
