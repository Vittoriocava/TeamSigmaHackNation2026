"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Camera, ChevronLeft, Crown, Loader2, MapPin, Search, Star,
  Trophy, Eye, Sparkles,
} from "lucide-react";
import { Button } from "@/components/UI/Button";
import { Card } from "@/components/UI/Card";
import { BottomNav } from "@/components/UI/BottomNav";
import { useStore } from "@/lib/store";

interface Challenge {
  id: string;
  city_slug: string;
  poi_id: string;
  poi_name: string;
  hint: string;
  week_start: string;
}

interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  xp_earned: number;
  submitted_at: string;
}

type Phase = "loading" | "select-city" | "challenge" | "camera" | "verifying" | "result";

const CITIES = [
  { name: "Roma", slug: "roma", emoji: "🏛️" },
  { name: "Milano", slug: "milano", emoji: "🗼" },
  { name: "Firenze", slug: "firenze", emoji: "🎨" },
  { name: "Napoli", slug: "napoli", emoji: "🌋" },
];

export default function SfidaPage() {
  const router = useRouter();
  const { token, user } = useStore();
  const [phase, setPhase] = useState<Phase>("select-city");
  const [selectedCity, setSelectedCity] = useState<typeof CITIES[0] | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [result, setResult] = useState<{
    verified: boolean;
    confidence: number;
    xp_earned: number;
    message: string;
  } | null>(null);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const loadChallenge = async (citySlug: string) => {
    setPhase("loading");
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    try {
      // Try to get existing challenge
      let res = await fetch(`${API}/api/challenge/weekly/${citySlug}`);
      let data = await res.json();

      if (!data.challenge) {
        // Generate one
        res = await fetch(`${API}/api/challenge/weekly/generate?city_slug=${citySlug}`, {
          method: "POST",
        });
        data = await res.json();
        if (data.challenge) {
          // Re-fetch to get leaderboard
          res = await fetch(`${API}/api/challenge/weekly/${citySlug}`);
          data = await res.json();
        }
      }

      if (data.challenge) {
        setChallenge(data.challenge);
        setLeaderboard(data.leaderboard || []);
        setPhase("challenge");
      } else {
        setError("Impossibile caricare la sfida");
        setPhase("select-city");
      }
    } catch {
      setError("Errore di connessione");
      setPhase("select-city");
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setPhase("camera");
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      setError("Impossibile accedere alla fotocamera");
    }
  };

  const captureAndSubmit = async () => {
    if (!videoRef.current || !canvasRef.current || !challenge) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];

    streamRef.current?.getTracks().forEach((t) => t.stop());
    setPhase("verifying");

    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    try {
      const res = await fetch(`${API}/api/challenge/weekly/${challenge.id}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ image_base64: base64 }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Errore");
      }

      const data = await res.json();
      setResult(data);
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nell'invio");
      setPhase("challenge");
    }
  };

  const userAlreadyFound = leaderboard.some((e) => e.user_id === user?.id);

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="px-4 pt-12 pb-3 sticky top-0 z-20 bg-black/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="glass rounded-full p-2 flex-shrink-0"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="font-display text-lg font-bold">Sfida Settimanale</h1>
            <p className="text-[10px] text-white/40">
              Trova il luogo misterioso e guadagna XP
            </p>
          </div>
          <Trophy size={20} className="text-yellow-400 ml-auto" />
        </div>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* Error banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-3 border border-red-500/30 text-center"
          >
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={() => setError("")} className="text-xs text-white/40 mt-1 underline">
              Chiudi
            </button>
          </motion.div>
        )}

        {/* Loading */}
        {phase === "loading" && (
          <div className="flex flex-col items-center py-16 gap-4">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm text-white/50">Carico la sfida...</p>
          </div>
        )}

        {/* CITY SELECTION */}
        {phase === "select-city" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Hero */}
            <Card className="text-center py-8 border border-primary/30 bg-gradient-to-b from-primary/10 to-transparent">
              <Sparkles size={40} className="text-primary mx-auto mb-3" />
              <h2 className="font-display text-xl font-bold mb-2">
                Trova il luogo misterioso
              </h2>
              <p className="text-sm text-white/60 leading-relaxed max-w-[280px] mx-auto">
                Ogni settimana un nuovo luogo da trovare.
                Scatta una foto per verificare e guadagna XP!
              </p>
            </Card>

            <p className="text-xs text-white/40 uppercase tracking-wider font-medium">
              Scegli città
            </p>

            <div className="grid grid-cols-2 gap-3">
              {CITIES.map((city) => (
                <motion.button
                  key={city.slug}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setSelectedCity(city);
                    loadChallenge(city.slug);
                  }}
                  className="glass rounded-2xl p-5 text-center hover:bg-white/10 transition-all border border-white/10"
                >
                  <span className="text-3xl block mb-2">{city.emoji}</span>
                  <p className="font-semibold text-sm">{city.name}</p>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* CHALLENGE VIEW */}
        {phase === "challenge" && challenge && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* City badge */}
            <div className="flex items-center gap-2">
              <span className="text-xl">{selectedCity?.emoji || "🏙️"}</span>
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider">
                  Sfida · {selectedCity?.name || challenge.city_slug}
                </p>
                <p className="text-[10px] text-white/30">
                  Settimana del {challenge.week_start}
                </p>
              </div>
            </div>

            {/* Hint card */}
            <Card className="border border-primary/30 bg-gradient-to-br from-primary/10 via-transparent to-accent/10">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Eye size={20} className="text-primary-light" />
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                    Indizio
                  </p>
                  <p className="text-sm text-white/80 leading-relaxed italic font-medium">
                    &ldquo;{challenge.hint}&rdquo;
                  </p>
                </div>
              </div>
            </Card>

            {/* XP rewards info */}
            <Card>
              <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                Ricompense XP
              </h4>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {["🥇 500", "🥈 300", "🥉 200", "4° 150", "5° 100"].map((r, i) => (
                  <div
                    key={i}
                    className={`flex-shrink-0 glass rounded-xl px-3 py-2 text-xs font-mono ${
                      i === 0 ? "border border-yellow-500/30 text-yellow-300" :
                      i === 1 ? "border border-gray-400/30 text-gray-300" :
                      i === 2 ? "border border-amber-600/30 text-amber-400" :
                      "text-white/40"
                    }`}
                  >
                    {r} XP
                  </div>
                ))}
              </div>
            </Card>

            {/* Action */}
            {userAlreadyFound ? (
              <Card className="text-center py-6 border border-green-500/30">
                <span className="text-3xl block mb-2">✅</span>
                <p className="font-semibold text-green-400">Hai già trovato il luogo!</p>
                <p className="text-xs text-white/40 mt-1">
                  Aspetta la prossima sfida settimanale
                </p>
              </Card>
            ) : (
              <Button className="w-full py-4 text-base" onClick={startCamera}>
                📷 Scatta e verifica
              </Button>
            )}

            {/* Leaderboard */}
            {leaderboard.length > 0 && (
              <Card>
                <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Crown size={12} className="text-yellow-400" />
                  Chi l&apos;ha trovato
                </h4>
                <div className="space-y-2">
                  {leaderboard.map((entry, i) => (
                    <div key={entry.user_id} className="flex items-center gap-3 glass rounded-xl px-3 py-2">
                      <span className={`text-sm font-mono font-bold ${
                        i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-400" : "text-white/40"
                      }`}>
                        #{i + 1}
                      </span>
                      <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center text-[10px] font-bold">
                        {(entry.display_name || "?")[0].toUpperCase()}
                      </div>
                      <p className="text-sm font-medium flex-1 truncate">
                        {entry.display_name || "Anonimo"}
                      </p>
                      <span className="text-xs text-primary-light font-mono">
                        +{entry.xp_earned} XP
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </motion.div>
        )}

        {/* CAMERA */}
        {phase === "camera" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="overflow-hidden p-0">
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full aspect-[4/3] object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute top-3 left-3 right-3">
                  <div className="glass rounded-xl px-3 py-2 text-center">
                    <p className="text-xs text-white/70">
                      Inquadra il luogo misterioso
                    </p>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3 flex gap-2 bg-gradient-to-t from-black/80 to-transparent">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      streamRef.current?.getTracks().forEach((t) => t.stop());
                      setPhase("challenge");
                    }}
                  >
                    Annulla
                  </Button>
                  <Button className="flex-1" onClick={captureAndSubmit}>
                    📸 Verifica luogo
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* VERIFYING */}
        {phase === "verifying" && (
          <div className="flex flex-col items-center py-16 gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            >
              <Search size={36} className="text-primary" />
            </motion.div>
            <p className="text-sm text-white/60">L&apos;AI sta verificando...</p>
            <p className="text-[10px] text-white/30">
              Confronto con il luogo misterioso in corso
            </p>
          </div>
        )}

        {/* RESULT */}
        {phase === "result" && result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            <Card className={`text-center py-8 border ${
              result.verified ? "border-green-500/40 bg-green-500/5" : "border-red-500/30 bg-red-500/5"
            }`}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="text-5xl mb-4"
              >
                {result.verified ? "🎉" : "🤔"}
              </motion.div>

              <h3 className="font-display text-xl font-bold mb-2">
                {result.verified ? "Trovato!" : "Non è il posto giusto"}
              </h3>

              <p className="text-sm text-white/60 mb-4">
                {result.message}
              </p>

              {result.verified && result.xp_earned > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="inline-flex items-center gap-2 bg-primary/20 rounded-full px-5 py-2 border border-primary/40"
                >
                  <Star size={16} className="text-yellow-400" />
                  <span className="font-display font-bold text-primary-light">
                    +{result.xp_earned} XP
                  </span>
                </motion.div>
              )}
            </Card>

            <div className="flex gap-3">
              {!result.verified && (
                <Button
                  className="flex-1"
                  onClick={() => {
                    setResult(null);
                    startCamera();
                  }}
                >
                  Riprova 📷
                </Button>
              )}
              <Button
                variant="secondary"
                className={result.verified ? "w-full" : ""}
                onClick={() => {
                  setResult(null);
                  setPhase("select-city");
                  setChallenge(null);
                }}
              >
                {result.verified ? "Torna alle sfide" : "Indietro"}
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
