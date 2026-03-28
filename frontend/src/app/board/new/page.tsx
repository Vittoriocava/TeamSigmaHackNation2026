"use client";

import { Button } from "@/components/UI/Button";
import { Card } from "@/components/UI/Card";
import { useStore, BoardStop } from "@/lib/store";
import { AlertCircle, ChevronRight, Loader } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface City {
  name: string;
  slug: string;
  lat: number;
  lng: number;
  description: string;
}

export default function NewBoardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryCity = searchParams.get("city");
  const mode = searchParams.get("mode") || "solo";
  const { user, setCurrentGame } = useStore();

  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingGame, setCreatingGame] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Se arriva con query param city, crea il gioco direttamente senza mostrare la UI
  useEffect(() => {
    if (queryCity) {
      const city: City = {
        name: queryCity,
        slug: queryCity.toLowerCase().replace(/\s+/g, "-").replace(/'/g, ""),
        lat: 41.8902,
        lng: 12.4922,
        description: "",
      };
      setSelectedCity(city);
      setCreatingGame(true);
      proceedToGame(city);
    } else {
      fetchCities();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCities = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/city/list`
      );
      const data = await res.json();
      setCities(data.cities || []);
    } catch (err) {
      setSearchError("Errore nel caricamento delle città");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const searchCity = (cityName: string) => {
    setSearchError("");
    setSearchInput(cityName);
    const city: City = {
      name: cityName,
      slug: cityName.toLowerCase().replace(/\s+/g, "-").replace(/'/g, ""),
      lat: 41.8902,
      lng: 12.4922,
      description: "",
    };
    setSelectedCity(city);
    setCreatingGame(true);
    proceedToGame(city);
  };

  const proceedToGame = async (city: City) => {
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    try {
      const gameRes = await fetch(`${API}/api/game/create-demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: city.name,
          mode: mode,
          duration_days: 1,
          budget: "medio",
          profile: { interests: [] },
        }),
      });

      if (!gameRes.ok) {
        throw new Error(`API error: ${gameRes.status}`);
      }

      const gameData = await gameRes.json();
      const gameId = gameData.game_id || `local-${city.slug}-${Date.now()}`;

      // Store board in Zustand so the board page can use it when gameId is local-*
      if (gameData.board) {
        setCurrentGame({
          id: gameId,
          city: gameData.board.city || city.name,
          citySlug: gameData.board.city_slug || city.slug,
          mode: mode,
          stops: (gameData.board.stops || []) as BoardStop[],
          currentStopIndex: 0,
          score: 0,
        });
      }

      router.push(`/board/${gameId}?city=${encodeURIComponent(city.name)}&mode=${mode}`);
    } catch (err) {
      setSearchError("Errore nella creazione del gioco. Riprova.");
      setCreatingGame(false);
      console.error(err);
    }
  };

  // If city came from query param, show full-screen loading while game is being created
  if (creatingGame) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <Loader size={40} className="animate-spin text-primary mb-6" />
        <h2 className="font-display text-xl font-bold mb-2">
          Preparando l&apos;avventura a {selectedCity?.name}
        </h2>
        <p className="text-white/50 text-sm">
          L&apos;AI sta generando il tuo percorso di gioco...
        </p>
        {searchError && (
          <div className="mt-6 text-red-400 text-sm">
            <p>{searchError}</p>
            <button
              onClick={() => router.back()}
              className="mt-3 glass px-4 py-2 rounded-xl text-white/70 text-xs"
            >
              Torna indietro
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 pb-20">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold mb-2">Scegli una città</h1>
          <p className="text-white/50">Seleziona da dove vuoi iniziare la tua avventura</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Cerca una città..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchInput.trim()) {
                searchCity(searchInput);
              }
            }}
            className="w-full glass rounded-xl py-3 px-4 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Errore di ricerca */}
        {searchError && (
          <Card className="mb-6 border-l-4 border-red-500/50 bg-red-500/5 flex items-start gap-3">
            <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-300">{searchError}</p>
            </div>
          </Card>
        )}

        {/* Loading state */}
        {loading ? (
          <Card className="text-center py-8">
            <Loader size={24} className="mx-auto animate-spin text-primary mb-3" />
            <p className="text-white/70">Caricamento città disponibili...</p>
          </Card>
        ) : (
          <>
            {/* Lista di città */}
            <div className="space-y-2 max-h-96 overflow-y-auto mb-6">
              {cities.map((city) => (
                <Card
                  key={city.slug}
                  onClick={() => { setCreatingGame(true); proceedToGame(city); }}
                  className={`flex items-center justify-between transition-all cursor-pointer ${
                    selectedCity?.slug === city.slug
                      ? "border border-primary/50 bg-primary/10"
                      : "hover:bg-white/5"
                  }`}
                >
                  <div>
                    <h3 className="font-semibold text-base">{city.name}</h3>
                    <p className="text-xs text-white/50">{city.description}</p>
                  </div>
                  <ChevronRight size={18} className="text-white/30" />
                </Card>
              ))}
            </div>

            {/* Bottone Indietro */}
            <Button
              onClick={() => router.push("/")}
              className="w-full !bg-white/5 hover:!bg-white/10"
            >
              Indietro
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
