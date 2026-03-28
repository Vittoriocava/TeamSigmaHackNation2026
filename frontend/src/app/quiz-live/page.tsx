"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Zap, Users, Plus, Copy, Check } from "lucide-react";
import { Button } from "@/components/UI/Button";
import { Card } from "@/components/UI/Card";
import { BottomNav } from "@/components/UI/BottomNav";

const MOCK_SESSIONS = [
  { code: "ROMA42", city: "Roma", players: 5, status: "waiting" },
  { code: "NAP007", city: "Napoli", players: 3, status: "active" },
  { code: "FIR88", city: "Firenze", players: 2, status: "waiting" },
];

export default function QuizLivePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newCity, setNewCity] = useState("");
  const [copied, setCopied] = useState(false);

  return (
    <div className="min-h-screen pb-20">
      <header className="px-4 pt-12 pb-4">
        <h1 className="font-display text-2xl font-bold">Quiz Live</h1>
        <p className="text-white/50 text-sm mt-1">
          Sfida altri giocatori in tempo reale
        </p>
      </header>

      {/* Join/Create */}
      <section className="px-4 mb-6">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Inserisci codice stanza"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="flex-1 glass rounded-xl py-3 px-4 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-lg tracking-widest text-center"
          />
          <Button
            onClick={() => {
              if (joinCode.length >= 4) {
                router.push(`/quiz-live/${joinCode}`);
              }
            }}
            disabled={joinCode.length < 4}
          >
            Unisciti
          </Button>
        </div>

        <Button
          variant="secondary"
          className="w-full flex items-center justify-center gap-2"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus size={18} />
          Crea nuova sessione
        </Button>

        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-3"
            >
              <div className="glass rounded-xl p-4">
                <input
                  type="text"
                  placeholder="Nome città (es: Roma)"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  className="w-full bg-white/5 rounded-xl py-3 px-4 mb-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <Button className="w-full">
                  <Zap size={16} className="mr-2 inline" />
                  Crea Sessione
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Active sessions */}
      <section className="px-4">
        <h2 className="font-semibold mb-3">Sessioni attive</h2>
        <div className="space-y-2">
          {MOCK_SESSIONS.map((session) => (
            <Card
              key={session.code}
              onClick={() => router.push(`/quiz-live/${session.code}`)}
              className="flex items-center gap-3"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  session.status === "waiting"
                    ? "bg-green-500/20"
                    : "bg-yellow-500/20"
                }`}
              >
                <Zap
                  size={18}
                  className={
                    session.status === "waiting"
                      ? "text-green-400"
                      : "text-yellow-400"
                  }
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">{session.city}</h3>
                  <span className="font-mono text-xs text-white/40">
                    {session.code}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Users size={12} />
                  <span>{session.players} giocatori</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      session.status === "waiting"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {session.status === "waiting" ? "In attesa" : "In corso"}
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(session.code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="glass rounded-lg p-2"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              </button>
            </Card>
          ))}
        </div>
      </section>

      <div className="h-20" />
      <BottomNav />
    </div>
  );
}
