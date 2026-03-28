"use client";

import { Button } from "@/components/UI/Button";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AuthPage() {
  const router = useRouter();
  const { setUser, setToken } = useStore();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        // First create auth user
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email,
          password,
          options: { 
            data: { display_name: displayName },
            emailRedirectTo: `${window.location.origin}/auth?mode=login`
          },
        });
        if (authErr) throw authErr;
        
        if (!authData.user) throw new Error("Signup failed");
        
        // Handle email confirmation requirement
        if (!authData.session) {
          setError("Controlla la tua email per confermare l'account");
          return;
        }
        
        // User created successfully
        setUser({
          id: authData.user.id,
          email: authData.user.email || "",
          displayName: displayName,
          avatarUrl: "",
          level: 1,
          xp: 0,
        });
        setToken(authData.session.access_token);
        router.push("/onboarding");
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (err) {
          if (err.message.includes("Invalid login credentials")) {
            throw new Error("Email o password non corretti");
          }
          throw err;
        }
        if (data.user && data.session) {
          setUser({
            id: data.user.id,
            email: data.user.email || "",
            displayName: data.user.user_metadata?.display_name || email.split("@")[0],
            avatarUrl: "",
            level: 1,
            xp: 0,
          });
          setToken(data.session.access_token);
          router.push("/");
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore di autenticazione";
      setError(message);
      console.error("Auth error:", message);
    } finally {
      setLoading(false);
    }
  };

  // Demo mode — skip auth
  const handleDemo = () => {
    setUser({
      id: "demo-user",
      email: "demo@playthecity.it",
      displayName: "Player Demo",
      avatarUrl: "",
      level: 5,
      xp: 750,
    });
    setToken("demo-token");
    router.push("/onboarding");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Play The City
          </h1>
          <p className="text-white/50 mt-2">
            Vivi la città da player, non da turista
          </p>
        </div>

        {/* Auth form */}
        <div className="glass rounded-2xl p-6">
          <div className="flex gap-1 mb-6 glass rounded-xl p-1">
            <button
              onClick={() => setMode("register")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === "register" ? "bg-primary text-white" : "text-white/50"
              }`}
            >
              Registrati
            </button>
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === "login" ? "bg-primary text-white" : "text-white/50"
              }`}
            >
              Accedi
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <input
                type="text"
                placeholder="Il tuo nome"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full bg-white/5 rounded-xl py-3 px-4 text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-white/5 rounded-xl py-3 px-4 text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-white/5 rounded-xl py-3 px-4 text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "..."
                : mode === "register"
                ? "Crea Account"
                : "Accedi"}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/30">oppure</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <Button
            variant="secondary"
            className="w-full"
            onClick={handleDemo}
          >
            Prova in modalità Demo
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
