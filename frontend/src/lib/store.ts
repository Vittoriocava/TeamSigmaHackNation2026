import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  level: number;
  xp: number;
}

export interface Profile {
  interests: string[];
  ageRange: string;
  culturalLevel: string;
  language: string;
  pace: string;
}

export interface GameState {
  id: string;
  city: string;
  citySlug: string;
  mode: string;
  stops: BoardStop[];
  currentStopIndex: number;
  score: number;
}

export interface BoardStop {
  poi: POI;
  type: string;
  content: Record<string, unknown>;
  completed: boolean;
}

export interface POI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  description: string;
  relevance_score: number;
  estimated_cost: string;
  estimated_duration: number;
  hidden_gem: boolean;
  why_for_you: string;
}

export interface TripProfile {
  days: number;
  budget: "economico" | "medio" | "comfort" | "lusso";
  group: "solo" | "coppia" | "famiglia" | "gruppo";
  interests: string[];
  pace: "slow" | "medium" | "fast";
  experienceType: "classico" | "esploratore" | "mix";
  startDate?: string; // ISO date "YYYY-MM-DD"
}

export interface RankedPOI extends POI {
  crowd_level: string;
}

export interface ItineraryStop {
  poi_id: string;
  poi_name: string;
  arrival_time: string;
  duration_min: number;
  transport: string;
  distance_from_prev: string;
  tips: string;
}

export interface ItineraryDay {
  day: number;
  theme: string;
  stops: ItineraryStop[];
  lunch_suggestion: string;
  dinner_suggestion: string;
  total_cost_estimate: string;
}

export interface TripState {
  city: string;
  tripProfile: TripProfile | null;
  rankedPois: RankedPOI[];
  likedPois: RankedPOI[];
  itinerary: ItineraryDay[];
}

export interface ItineraryPOI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
}

export interface SavedItinerary {
  id: string;
  city: string;
  createdAt: string;
  days: number;
  likedPoisCount: number;
  itinerary: ItineraryDay[];
  tripProfile: TripProfile;
  pois?: ItineraryPOI[];
  startDate?: string; // ISO date "YYYY-MM-DD"
}

interface AppStore {
  user: User | null;
  profile: Profile | null;
  currentGame: GameState | null;
  token: string | null;
  coins: number;
  isHydrated: boolean;
  userPosition: { lat: number; lng: number } | null;

  // Trip planning (not persisted — session only)
  trip: TripState;
  // Saved itineraries (persisted)
  savedItineraries: SavedItinerary[];

  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setCurrentGame: (game: GameState | null) => void;
  setToken: (token: string | null) => void;
  setCoins: (coins: number) => void;
  setUserPosition: (pos: { lat: number; lng: number } | null) => void;
  completeStop: (index: number) => void;
  setTrip: (trip: Partial<TripState>) => void;
  saveItinerary: (itinerary: SavedItinerary) => void;
  reset: () => void;
}

const DEFAULT_TRIP: TripState = {
  city: "",
  tripProfile: null,
  rankedPois: [],
  likedPois: [],
  itinerary: [],
};

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      user: null,
      profile: null,
      currentGame: null,
      token: null,
      coins: 0,
      isHydrated: false,
      userPosition: null,
      trip: DEFAULT_TRIP,
      savedItineraries: [],

      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setCurrentGame: (game) => set({ currentGame: game }),
      setToken: (token) => set({ token }),
      setCoins: (coins) => set({ coins }),
      setUserPosition: (pos) => set({ userPosition: pos }),
      setTrip: (partial) =>
        set((state) => ({ trip: { ...state.trip, ...partial } })),
      saveItinerary: (itinerary) =>
        set((state) => ({
          savedItineraries: [
            itinerary,
            ...state.savedItineraries.filter((s) => s.id !== itinerary.id),
          ].slice(0, 10), // keep last 10
        })),
      completeStop: (index) =>
        set((state) => {
          if (!state.currentGame) return {};
          const stops = [...state.currentGame.stops];
          stops[index] = { ...stops[index], completed: true };
          return {
            currentGame: {
              ...state.currentGame,
              stops,
              currentStopIndex: index + 1,
              score: state.currentGame.score + 10,
            },
          };
        }),
      reset: () =>
        set({
          user: null,
          profile: null,
          currentGame: null,
          token: null,
          coins: 0,
          userPosition: null,
          trip: DEFAULT_TRIP,
          savedItineraries: [],
        }),
    }),
    {
      name: "play-the-city",
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        currentGame: state.currentGame,
        token: state.token,
        coins: state.coins,
        savedItineraries: state.savedItineraries,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.isHydrated = true;
      },
    }
  )
);
