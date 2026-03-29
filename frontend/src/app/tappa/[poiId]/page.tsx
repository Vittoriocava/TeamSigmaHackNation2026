"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft, Volume2, Camera, Clock, MapPin,
  Shield, Star, Share2, Puzzle, Loader, HelpCircle, Loader2, Pause
} from "lucide-react";
import { Button } from "@/components/UI/Button";
import { Card } from "@/components/UI/Card";
import { useStore } from "@/lib/store";
import { apiGet } from "@/lib/api";
import { PoiQuizModal } from "@/components/Quiz/PoiQuizModal";

const TIMELINE_ERAS = [
  { label: "Origini", year: 0, description: "Le prime origini storiche del luogo" },
  { label: "Medioevo", year: 1200, description: "Il periodo medievale" },
  { label: "1800", year: 1800, description: "Il XIX secolo" },
  { label: "1900", year: 1950, description: "Il Novecento" },
  { label: "Oggi", year: 2024, description: "Patrimonio contemporaneo" },
];

interface TerritoryOwner {
  name: string;
  tier: number;
  weeks: number;
  userId: string;
  phrase: string;
}

export default function TappaPage() {
  const params = useParams();
  const router = useRouter();
  const poiId = params.poiId as string;

  const { trip, currentGame, savedItineraries, token, user, userPosition } = useStore();

  const [activeTab, setActiveTab] = useState<"info" | "timeline" | "ar" | "pieces">("info");
  const [selectedEra, setSelectedEra] = useState(0);
  const [narratingStatus, setNarratingStatus] = useState<"idle" | "loading" | "playing">("idle");
  const [owner, setOwner] = useState<TerritoryOwner | null>(null);
  const [territoryStatus, setTerritoryStatus] = useState<"free" | "mine" | "other">("free");
  const [piecesCollected, setPiecesCollected] = useState(0);
  const [piecesLoading, setPiecesLoading] = useState(true);
  const [showQuiz, setShowQuiz] = useState(false);
  const [conquering, setConquering] = useState(false);
  const [userPos, setUserPos] = useState<{lat: number, lng: number} | null>(null);
  const [greeting, setGreeting] = useState(false);
  const [greeted, setGreeted] = useState(false);
  const [phraseInput, setPhraseInput] = useState("");
  const [showPhraseModal, setShowPhraseModal] = useState(false);
  const [arPhase, setArPhase] = useState<"idle" | "camera" | "processing" | "result">("idle");
  const [arResult, setArResult] = useState<{ analysis: Record<string, unknown>; historical_image: Record<string, unknown> } | null>(null);
  const [arError, setArError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [arEra, setArEra] = useState("1200");

  // Look up POI from store: trip.rankedPois → currentGame.stops → savedItineraries
  const poi = (() => {
    // 1. From current trip ranked POIs
    const fromTrip = trip.rankedPois.find((p) => p.id === poiId);
    if (fromTrip) return { ...fromTrip, city: trip.city };

    // 2. From current game board stops
    if (currentGame) {
      const stop = currentGame.stops.find((s) => s.poi.id === poiId);
      if (stop) return { ...stop.poi, city: currentGame.city };
    }

    // 3. From saved itineraries — they store poi_id/poi_name in stops but not full POI
    // Try to reconstruct minimal info
    for (const saved of savedItineraries) {
      for (const day of saved.itinerary) {
        const stop = day.stops.find((s) => s.poi_id === poiId);
        if (stop) {
          return {
            id: poiId,
            name: stop.poi_name,
            city: saved.city,
            category: "cultura",
            description: stop.tips || "Scopri questo luogo affascinante",
            lat: 0,
            lng: 0,
            relevance_score: 0,
            estimated_cost: "",
            estimated_duration: stop.duration_min,
            hidden_gem: false,
            why_for_you: stop.tips || "",
            crowd_level: "",
          };
        }
      }
    }

    return null;
  })();

  // Fetch territory ownership
  useEffect(() => {
    if (!poiId) return;
    const fetchOwner = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`/api/territory/poi/${encodeURIComponent(poiId)}`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        if (data.owner) {
          const o = data.owner;
          setOwner({
            name: o.users?.display_name || o.user_id || "Anonimo",
            tier: o.tier || 1,
            weeks: o.weeks_held || 0,
            userId: o.user_id || "",
            phrase: data.custom_phrase || o.custom_phrase || "",
          });
          setTerritoryStatus(o.user_id === user?.id ? "mine" : "other");
        } else {
          setTerritoryStatus("free");
        }
      } catch {
        // Territory info is optional, ignore errors
      }
    };
    fetchOwner();
  }, [poiId, token, user?.id]);

  // Fetch user's pieces for this POI
  useEffect(() => {
    if (!user?.id || !poiId) {
      setPiecesLoading(false);
      return;
    }
    apiGet<{ pieces: { poi_id: string; pieces_collected: number }[] }>(
      `/api/itineraries/pieces/user/${user.id}`,
      token ?? undefined,
    )
      .then((data) => {
        const myPiece = data.pieces.find((p) => p.poi_id === poiId);
        setPiecesCollected(myPiece?.pieces_collected ?? 0);
      })
      .catch(() => {})
      .finally(() => setPiecesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, poiId]);

  if (!poi) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader size={32} className="animate-spin text-primary" />
        <p className="text-white/60 text-sm">Caricamento luogo...</p>
        <button onClick={() => router.back()} className="text-xs text-white/40 underline mt-2">
          Torna indietro
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Quiz modal */}
      <AnimatePresence>
        {showQuiz && (
          <PoiQuizModal
            poiId={poiId}
            poiName={poi.name}
            poiDescription={poi.description || poi.why_for_you}
            city={poi.city}
            token={token}
            isSteal={territoryStatus === "other"}
            onClose={async (result) => {
              if (result?.pieces_total !== undefined) {
                setPiecesCollected(result.pieces_total);
              }
              setShowQuiz(false);

              // Auto-conquer if it was a successful steal (100% score)
              if (result && territoryStatus === "other" && result.correct === result.total && userPos && token) {
                try {
                  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                  const res = await fetch(`${API}/api/territory/conquer`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      poi_id: poiId,
                      city_slug: (poi?.city || "").toLowerCase().replace(/ /g, "-").replace(/'/g, ""),
                      lat: userPos.lat,
                      lng: userPos.lng,
                    }),
                  });
                  if (res.ok) {
                    setTerritoryStatus("mine");
                    setOwner({
                      name: user?.displayName || "Tu",
                      tier: 1,
                      weeks: 0,
                      userId: user?.id || "",
                      phrase: "",
                    });
                    setTimeout(() => setShowPhraseModal(true), 600); // let modal close
                  }
                } catch (e) {
                  console.error("Error during steal conquer:", e);
                }
              }
            }}
          />
        )}
      </AnimatePresence>

      <div className="min-h-screen pb-8">
        {/* Hero area */}
        <div className="relative h-[280px]">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/30 to-gray-950" />
          <div className="absolute inset-0 flex items-end p-4">
            <div className="w-full">
              <button
                onClick={() => router.back()}
                className="glass rounded-full p-2 mb-4"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <MapPin size={14} className="text-primary-light" />
                <span className="text-xs text-white/60">{poi.city}</span>
                <span className="text-xs glass px-2 py-0.5 rounded-full">
                  {poi.category}
                </span>
              </div>
              <h1 className="font-display text-3xl font-bold">{poi.name}</h1>
            </div>
          </div>
        </div>

        {/* Owner badge */}
        {owner && (
          <div className="px-4 -mt-2 mb-4">
            <div className="glass rounded-xl p-3">
              <div className="flex items-center gap-3 mb-2">
                <Shield size={18} className="text-blue-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Territorio di{" "}
                    <span className="text-blue-400">{owner.name}</span>
                  </p>
                  <p className="text-[10px] text-white/50">
                    Tier {owner.tier} · {owner.weeks} settimane
                  </p>
                </div>
                {territoryStatus === "other" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (greeting || greeted || !token) return;
                      setGreeting(true);
                      try {
                        const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                        await fetch(`${API}/api/territory/greet?poi_id=${poiId}`, {
                          method: "POST",
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        setGreeted(true);
                      } catch {} finally { setGreeting(false); }
                    }}
                    disabled={greeted}
                  >
                    {greeted ? "✅ Salutato!" : greeting ? "..." : "👋 Saluta"}
                  </Button>
                )}
              </div>
              {/* Owner's custom phrase */}
              {owner.phrase && (
                <div className="bg-white/5 rounded-lg px-3 py-2 mt-1">
                  <p className="text-xs text-white/70 italic">&ldquo;{owner.phrase}&rdquo;</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="px-4 mb-4">
          <div className="flex gap-1 glass rounded-xl p-1">
            {[
              { key: "info", label: "Info" },
              { key: "timeline", label: "Timeline" },
              { key: "ar", label: "Nel Tempo" },
              { key: "pieces", label: "Pezzi" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-primary text-white"
                    : "text-white/50 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="px-4">
          <AnimatePresence mode="wait">
            {activeTab === "info" && (
              <motion.div
                key="info"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <p className="text-sm text-white/80 leading-relaxed mb-4">
                  {poi.why_for_you || poi.description}
                </p>

                {/* Audio narration */}
                {(() => {
                  const handleNarrate = async () => {
                    if (narratingStatus === "playing") {
                      // Stop playback
                      const audio = document.getElementById("narration-audio") as HTMLAudioElement;
                      if (audio) { audio.pause(); audio.currentTime = 0; }
                      setNarratingStatus("idle");
                      return;
                    }
                    if (narratingStatus === "loading") return;

                    setNarratingStatus("loading");
                    try {
                      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                      const res = await fetch(`${API}/api/audio/narrate`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                        body: JSON.stringify({
                          poi_id: poiId,
                          poi_name: poi.name,
                          city: poi.city,
                          mode: "on_demand",
                          wikipedia_excerpt: poi.description || "",
                          wikidata_facts: "",
                          user_profile: { language: "it", cultural_level: "casual", interests: ["storia", "curiosità"] },
                        }),
                      });
                      const data = await res.json();
                      if (data.audio_base64) {
                        const audioSrc = `data:audio/mpeg;base64,${data.audio_base64}`;
                        let audio = document.getElementById("narration-audio") as HTMLAudioElement;
                        if (!audio) {
                          audio = document.createElement("audio");
                          audio.id = "narration-audio";
                          document.body.appendChild(audio);
                        }
                        audio.src = audioSrc;
                        audio.onended = () => setNarratingStatus("idle");
                        audio.onpause = () => setNarratingStatus("idle");
                        audio.onplay = () => setNarratingStatus("playing");
                        await audio.play();
                      } else {
                        setNarratingStatus("idle");
                      }
                    } catch {
                      setNarratingStatus("idle");
                    }
                  };
                  return (
                    <Card
                      onClick={handleNarrate}
                      className="flex items-center gap-3 mb-3 cursor-pointer hover:bg-white/10 transition-colors"
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          narratingStatus === "loading" ? "bg-primary animate-pulse" : narratingStatus === "playing" ? "bg-primary/40 pulse-ring" : "bg-primary/20"
                        }`}
                      >
                        {narratingStatus === "loading" ? <Loader2 size={18} className="animate-spin text-primary-light" /> :
                         narratingStatus === "playing" ? <Pause size={18} className="text-primary-light" /> :
                         <Volume2 size={18} className="text-primary-light" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {narratingStatus === "loading" ? "Generazione AI in corso..." :
                           narratingStatus === "playing" ? "In riproduzione (tocca per fermare)" :
                           "Raccontami questo posto"}
                        </p>
                        <p className="text-[10px] text-white/50">
                          Narrazione AI con Fun Facts · ElevenLabs
                        </p>
                      </div>
                      {narratingStatus === "playing" && (
                        <div className="flex gap-0.5 items-end h-6 flex-shrink-0">
                          {[...Array(5)].map((_, i) => (
                            <motion.div
                              key={i}
                              animate={{ height: [4, 16, 4] }}
                              transition={{ duration: 0.6, delay: i * 0.1, repeat: Infinity }}
                              className="w-1 bg-primary-light rounded-t-sm"
                            />
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })()}

                {/* Quick info */}
                <div className="grid grid-cols-3 gap-2">
                  <Card animate={false} className="text-center">
                    <Clock size={16} className="text-white/50 mx-auto mb-1" />
                    <p className="text-sm font-bold">
                      {poi.estimated_duration ? `${poi.estimated_duration} min` : "—"}
                    </p>
                    <p className="text-[10px] text-white/40">Durata</p>
                  </Card>
                  <Card animate={false} className="text-center">
                    <span className="text-sm block mb-1">€</span>
                    <p className="text-sm font-bold">{poi.estimated_cost || "—"}</p>
                    <p className="text-[10px] text-white/40">Ingresso</p>
                  </Card>
                  <Card animate={false} className="text-center">
                    <Star size={16} className="text-yellow-400 mx-auto mb-1" />
                    <p className="text-sm font-bold">
                      {poi.relevance_score ? poi.relevance_score.toFixed(1) : "—"}
                    </p>
                    <p className="text-[10px] text-white/40">Score</p>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab === "timeline" && (
              <motion.div
                key="timeline"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h3 className="font-semibold mb-3">Linea del Tempo</h3>

                {/* Era selector */}
                <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide mb-4">
                  {TIMELINE_ERAS.map((era, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedEra(i)}
                      className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        selectedEra === i
                          ? "bg-primary text-white"
                          : "glass text-white/60"
                      }`}
                    >
                      {era.label}
                    </button>
                  ))}
                </div>

                {/* Image placeholder */}
                <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-3 border border-white/10">
                  <div className="text-center">
                    <span className="text-4xl block mb-2">🏛️</span>
                    <p className="text-sm font-medium">
                      {poi.name} — {TIMELINE_ERAS[selectedEra].label}
                    </p>
                    <p className="text-xs text-white/50 mt-1">
                      {TIMELINE_ERAS[selectedEra].description}
                    </p>
                    <p className="text-[10px] text-primary-light mt-2">
                      Immagine generata da DALL-E 3
                    </p>
                  </div>
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min={0}
                  max={TIMELINE_ERAS.length - 1}
                  value={selectedEra}
                  onChange={(e) => setSelectedEra(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-white/40 mt-1">
                  <span>{TIMELINE_ERAS[0].label}</span>
                  <span>{TIMELINE_ERAS[TIMELINE_ERAS.length - 1].label}</span>
                </div>
              </motion.div>
            )}

            {activeTab === "ar" && (
              <motion.div
                key="ar"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {/* Era selector */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {["100 d.C.", "1200", "1800", "1950"].map((era) => (
                    <button
                      key={era}
                      onClick={() => setArEra(era)}
                      className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                        arEra === era ? "bg-primary text-white" : "glass text-white/60"
                      }`}
                    >
                      {era}
                    </button>
                  ))}
                </div>

                {arPhase === "idle" && (
                  <Card className="text-center py-8">
                    <Camera size={40} className="text-primary-light mx-auto mb-3" />
                    <h3 className="font-display text-lg font-bold mb-1">
                      Indietro nel tempo
                    </h3>
                    <p className="text-sm text-white/60 mb-1">
                      Scatta una foto di {poi.name} e vedi come appariva nel {arEra}
                    </p>
                    <Button
                      className="mt-4"
                      onClick={async () => {
                        try {
                          const stream = await navigator.mediaDevices.getUserMedia({
                            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
                          });
                          streamRef.current = stream;
                          setArPhase("camera");
                          setTimeout(() => {
                            if (videoRef.current) {
                              videoRef.current.srcObject = stream;
                              videoRef.current.play();
                            }
                          }, 100);
                        } catch {
                          setArError("Impossibile accedere alla fotocamera");
                        }
                      }}
                    >
                      📷 Apri Fotocamera
                    </Button>
                  </Card>
                )}

                {arPhase === "camera" && (
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
                      <div className="absolute bottom-0 left-0 right-0 p-3 flex gap-2 bg-gradient-to-t from-black/80 to-transparent">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            streamRef.current?.getTracks().forEach((t) => t.stop());
                            setArPhase("idle");
                          }}
                        >
                          Annulla
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={async () => {
                            if (!videoRef.current || !canvasRef.current) return;
                            const video = videoRef.current;
                            const canvas = canvasRef.current;
                            canvas.width = video.videoWidth;
                            canvas.height = video.videoHeight;
                            canvas.getContext("2d")!.drawImage(video, 0, 0);
                            const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
                            streamRef.current?.getTracks().forEach((t) => t.stop());
                            setArPhase("processing");
                            try {
                              const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                              const res = await fetch(`${API}/api/ai/vision/come-era`, {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                                },
                                body: JSON.stringify({
                                  image_base64: base64,
                                  poi_id: poiId,
                                  poi_name: poi.name,
                                  era: arEra,
                                }),
                              });
                              if (!res.ok) throw new Error("Errore Vision AI");
                              const data = await res.json();
                              setArResult(data);
                              setArPhase("result");
                            } catch {
                              setArError("Errore nell'analisi. Riprova.");
                              setArPhase("idle");
                            }
                          }}
                        >
                          📸 Scatta e analizza
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}

                {arPhase === "processing" && (
                  <Card className="text-center py-12">
                    <Loader2 size={36} className="animate-spin text-primary mx-auto mb-4" />
                    <p className="text-sm text-white/60">Analisi AI in corso...</p>
                    <p className="text-[10px] text-white/30 mt-1">
                      Ricostruisco {poi.name} nel {arEra}
                    </p>
                  </Card>
                )}

                {arPhase === "result" && arResult && (
                  <div className="space-y-3">
                    {/* AI Analysis */}
                    <Card>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Camera size={14} className="text-primary-light" />
                        Analisi AI
                      </h4>
                      <p className="text-xs text-white/70 leading-relaxed">
                        {(arResult.analysis as Record<string, string>)?.description || "Luogo identificato"}
                      </p>
                      {Boolean((arResult.analysis as Record<string, unknown>)?.identified) && (
                        <p className="text-[10px] text-green-400 mt-2">
                          ✓ Luogo riconosciuto: {String((arResult.analysis as Record<string, string>)?.place_name || "")}
                        </p>
                      )}
                    </Card>

                    {/* Historical reconstruction prompt */}
                    <Card>
                      <h4 className="text-sm font-semibold mb-2">🏛️ Ricostruzione storica — {arEra}</h4>
                      {(arResult.historical_image as Record<string, string>)?.image_url ? (
                        <img
                          src={(arResult.historical_image as Record<string, string>).image_url}
                          alt={`${poi.name} nel ${arEra}`}
                          className="w-full rounded-xl mb-2"
                        />
                      ) : (
                        <div className="bg-white/5 rounded-xl p-4 mb-2">
                          <p className="text-xs text-white/50 italic">
                            {(arResult.historical_image as Record<string, string>)?.dalle_prompt || "Prompt di ricostruzione generato"}
                          </p>
                        </div>
                      )}
                    </Card>

                    <Button
                      className="w-full"
                      onClick={() => {
                        setArPhase("idle");
                        setArResult(null);
                      }}
                    >
                      📷 Scatta un'altra foto
                    </Button>
                  </div>
                )}

                {arError && (
                  <div className="glass rounded-xl p-3 text-center">
                    <p className="text-sm text-red-400">{arError}</p>
                    <button
                      onClick={() => setArError("")}
                      className="text-xs text-white/40 mt-2 underline"
                    >
                      Chiudi
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "pieces" && (
              <motion.div
                key="pieces"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h3 className="font-semibold mb-1">Pezzi del Monumento</h3>
                <p className="text-xs text-white/50 mb-4">
                  Raccogli 3 pezzi da casa per pre-reclamare il territorio
                </p>

                {/* Pieces progress */}
                {piecesLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader size={24} className="animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <div className="flex gap-3 justify-center mb-6">
                      {[1, 2, 3].map((piece) => (
                        <motion.div
                          key={piece}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: piece * 0.1 }}
                          className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl ${
                            piece <= piecesCollected
                              ? "bg-primary/30 border-2 border-primary"
                              : "glass border-2 border-dashed border-white/20"
                          }`}
                        >
                          {piece <= piecesCollected ? (
                            <Puzzle size={28} className="text-primary-light" />
                          ) : (
                            <span className="text-white/20">?</span>
                          )}
                        </motion.div>
                      ))}
                    </div>

                    <p className="text-center text-sm mb-6">
                      <span className="text-primary-light font-bold">
                        {piecesCollected}
                      </span>
                      /3 pezzi raccolti
                    </p>

                    {/* Quiz to earn pieces */}
                    {piecesCollected < 3 ? (
                      <Button
                        className="w-full mb-3"
                        onClick={() => setShowQuiz(true)}
                      >
                        <HelpCircle size={16} className="mr-2" />
                        Quiz su {poi.name} → Guadagna 1 pezzo
                      </Button>
                    ) : territoryStatus === "free" ? (
                      <div className="space-y-3">
                        <div className="glass-dark rounded-xl p-4 text-center border border-green-500/30">
                          <p className="text-green-400 font-semibold">
                            3/3 pezzi raccolti! 🎉
                          </p>
                          <p className="text-xs text-white/50 mt-1">
                            Vai fisicamente al luogo per conquistarlo!
                          </p>
                        </div>
                        <Button
                          className="w-full"
                          onClick={async () => {
                            if (!token || conquering) return;
                            setConquering(true);
                            try {
                              let userLat: number, userLng: number;

                              if (userPosition) {
                                // DEMO BYPASS: Use map's click-to-move simulated position
                                userLat = userPosition.lat;
                                userLng = userPosition.lng;
                              } else {
                                // REAL GPS
                                const position = await new Promise<GeolocationPosition>((resolve, reject) =>
                                  navigator.geolocation.getCurrentPosition(resolve, reject, {
                                    enableHighAccuracy: true, timeout: 10000,
                                  })
                                );
                                userLat = position.coords.latitude;
                                userLng = position.coords.longitude;
                              }

                              const poiLat = poi.lat || 0;
                              const poiLng = poi.lng || 0;

                              // Haversine distance check (100m threshold)
                              const R = 6371000;
                              const dLat = (poiLat - userLat) * Math.PI / 180;
                              const dLng = (poiLng - userLng) * Math.PI / 180;
                              const a = Math.sin(dLat/2)**2 + Math.cos(userLat * Math.PI/180) * Math.cos(poiLat * Math.PI/180) * Math.sin(dLng/2)**2;
                              const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

                              if (dist > 100) {
                                alert(`Sei troppo lontano! (${Math.round(dist)}m) Avvicinati a meno di 100m dal luogo.`);
                                return;
                              }

                              const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                              const res = await fetch(`${API}/api/territory/conquer`, {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({
                                  poi_id: poiId,
                                  city_slug: (poi.city || "").toLowerCase().replace(/ /g, "-").replace(/'/g, ""),
                                  lat: userLat,
                                  lng: userLng,
                                }),
                              });
                              if (res.ok) {
                                setTerritoryStatus("mine");
                                setOwner({
                                  name: user?.displayName || "Tu",
                                  tier: 1,
                                  weeks: 0,
                                  userId: user?.id || "",
                                  phrase: "",
                                });
                                setShowPhraseModal(true);
                              }
                            } catch (err: any) {
                              if (err?.code === 1) {
                                alert("Permesso GPS negato. Abilita la geolocalizzazione per conquistare territori.");
                              }
                            } finally { setConquering(false); }
                          }}
                          disabled={conquering}
                        >
                          <MapPin size={16} className="mr-2" />
                          {conquering ? "Verifica GPS..." : "📍 Conquista (richiede GPS)"}
                        </Button>
                      </div>
                    ) : territoryStatus === "mine" ? (
                      <div className="glass-dark rounded-xl p-4 text-center border border-primary/30">
                        <p className="text-primary-light font-semibold">
                          È il tuo territorio! 👑
                        </p>
                        <p className="text-xs text-white/50 mt-1">
                          {owner?.phrase ? `"${owner.phrase}"` : "Aggiungi una frase personalizzata"}
                        </p>
                        <p className="text-[10px] text-white/30 mt-1">
                          Possesso valido 1 mese · Difesa settimanale per mantenere il livello
                        </p>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="mt-3"
                          onClick={() => setShowPhraseModal(true)}
                        >
                          {owner?.phrase ? "✏️ Modifica frase" : "✍️ Aggiungi frase"}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="glass-dark rounded-xl p-4 text-center border border-red-500/20">
                          <p className="text-red-400 font-semibold">
                            Territorio di {owner?.name} · Tier {owner?.tier}
                          </p>
                          <p className="text-xs text-white/50 mt-1">
                            Completa il quiz al livello attuale per rubarglielo!
                          </p>
                        </div>
                        <Button
                          className="w-full"
                          variant="secondary"
                          onClick={async () => {
                            try {
                              setConquering(true); // use to show 'Verifica GPS'
                              let userLat: number, userLng: number;

                              if (userPosition) {
                                // DEMO BYPASS: Use map's click-to-move simulated position
                                userLat = userPosition.lat;
                                userLng = userPosition.lng;
                              } else {
                                // REAL GPS
                                const position = await new Promise<GeolocationPosition>((resolve, reject) =>
                                  navigator.geolocation.getCurrentPosition(resolve, reject, {
                                    enableHighAccuracy: true, timeout: 10000,
                                  })
                                );
                                userLat = position.coords.latitude;
                                userLng = position.coords.longitude;
                              }

                              const poiLat = poi.lat || 0;
                              const poiLng = poi.lng || 0;

                              const R = 6371000;
                              const dLat = (poiLat - userLat) * Math.PI / 180;
                              const dLng = (poiLng - userLng) * Math.PI / 180;
                              const a = Math.sin(dLat/2)**2 + Math.cos(userLat * Math.PI/180) * Math.cos(poiLat * Math.PI/180) * Math.sin(dLng/2)**2;
                              const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

                              if (dist > 100) {
                                alert(`Sei troppo lontano! (${Math.round(dist)}m) Avvicinati a meno di 100m dal luogo.`);
                                setConquering(false);
                                return;
                              }
                              setUserPos({ lat: userLat, lng: userLng });
                              setShowQuiz(true);
                            } catch (err: any) {
                              if (err?.code === 1) {
                                alert("Permesso GPS negato. Abilita la geolocalizzazione per rubare territori.");
                              }
                            } finally {
                              setConquering(false);
                            }
                          }}
                          disabled={conquering}
                        >
                          <Shield size={16} className="mr-2" />
                          {conquering ? "Verifica GPS..." : `⚔️ Ruba (Lvl ${owner?.tier || 1})`}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Phrase modal */}
      <AnimatePresence>
        {showPhraseModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowPhraseModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0f0f1a] rounded-2xl p-6 w-full max-w-md"
            >
              <h3 className="font-display text-lg font-bold mb-2">La tua frase</h3>
              <p className="text-xs text-white/50 mb-4">
                Lascia un messaggio per chi visita questo luogo
              </p>
              <textarea
                value={phraseInput}
                onChange={(e) => setPhraseInput(e.target.value)}
                maxLength={200}
                placeholder="Es: Questo posto ha cambiato la mia vita..."
                className="w-full glass rounded-xl p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none h-24 mb-2"
              />
              <p className="text-[10px] text-white/30 mb-4 text-right">{phraseInput.length}/200</p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowPhraseModal(false)}
                >
                  Annulla
                </Button>
                <Button
                  className="flex-1"
                  onClick={async () => {
                    if (!token || !phraseInput.trim()) return;
                    try {
                      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                      await fetch(`${API}/api/territory/set-phrase`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ poi_id: poiId, phrase: phraseInput }),
                      });
                      if (owner) setOwner({ ...owner, phrase: phraseInput });
                      setShowPhraseModal(false);
                    } catch {}
                  }}
                >
                  ✅ Salva
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
