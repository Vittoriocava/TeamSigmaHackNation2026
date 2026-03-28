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

interface AppStore {
  user: User | null;
  profile: Profile | null;
  currentGame: GameState | null;
  token: string | null;
  coins: number;
  isHydrated: boolean;

  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setCurrentGame: (game: GameState | null) => void;
  setToken: (token: string | null) => void;
  setCoins: (coins: number) => void;
  completeStop: (index: number) => void;
  reset: () => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      user: null,
      profile: null,
      currentGame: null,
      token: null,
      coins: 0,
      isHydrated: false,

      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setCurrentGame: (game) => set({ currentGame: game }),
      setToken: (token) => set({ token }),
      setCoins: (coins) => set({ coins }),
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
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.isHydrated = true;
      },
    }
  )
);
