"use client";

import { Button } from "@/components/UI/Button";
import { Card } from "@/components/UI/Card";
import { useStore } from "@/lib/store";
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
  const { user } = useStore();

  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Carica le città dal backend
  useEffect(() => {
    fetchCities();
  }, []);

  // Se arriva con query param city, cerca quella città
  useEffect(() => {
    if (queryCity && cities.length > 0) {
      searchCity(queryCity);
    }
  }, [queryCity, cities]);

  const fetchCities = async () => {
    try {
      const res = await fetch("/api/city/list");
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
    setSearching(true);
    setSearchError("");
    setSearchInput(cityName);

    const found = cities.find(
      c => c.name.toLowerCase() === cityName.toLowerCase()
    );

    if (found) {
      // Città trovata nella lista
      setSelectedCity(found);
      setTimeout(() => {
        proceedToGame(found);
      }, 500);
    } else {
      // Città non nella lista - permettiamo comunque di crearla
      const customCity: City = {
        name: cityName,
        slug: cityName.toLowerCase().replace(/\s+/g, "-"),
        lat: 41.8902,
        lng: 12.4922,
        description: "Città personalizzata",
      };
      setSelectedCity(customCity);
      setTimeout(() => {
        proceedToGame(customCity);
      }, 500);
    }
    setSearching(false);
  };

  const proceedToGame = async (city: City) => {
    try {
      // Crea il gioco nel backend usando endpoint demo (no auth richiesta)
      const gameRes = await fetch("/api/game/create-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: city.name,
          mode: mode,
          duration_days: 3,
          budget: "medio",
          profile: { interests: [] },
        }),
      });

      if (!gameRes.ok) {
        throw new Error(`API error: ${gameRes.status}`);
      }

      const gameData = await gameRes.json();
      const gameId = gameData.id || `game-${city.slug}-${Date.now()}`;
      router.push(`/board/${gameId}?city=${encodeURIComponent(city.name)}&mode=${mode}`);
    } catch (err) {
      setSearchError("Errore nella creazione del gioco. Riprova.");
      console.error(err);
    }
  };

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
                  onClick={() => proceedToGame(city)}
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
