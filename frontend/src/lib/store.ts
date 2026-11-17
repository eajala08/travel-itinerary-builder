import { create } from 'zustand';
import type { ItineraryResponse } from '../types/itinerary';

const MAX_HISTORY = 10;

interface AppState {
  itinerary: ItineraryResponse | null;
  /** Previous versions of the current trip, newest last, so AI edits can be undone. */
  history: ItineraryResponse[];
  loading: boolean;
  editingLoading: boolean;
  error: string | null;

  /** Replace the trip entirely (new build or loaded trip) and clear undo history. */
  setItinerary: (itinerary: ItineraryResponse) => void;
  /** Apply an edit to the current trip, keeping the old version for undo. */
  applyEdit: (itinerary: ItineraryResponse) => void;
  undo: () => void;
  setLoading: (loading: boolean) => void;
  setEditingLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  itinerary: null,
  history: [],
  loading: false,
  editingLoading: false,
  error: null,

  setItinerary: (itinerary) => set({ itinerary, history: [], error: null }),
  applyEdit: (itinerary) =>
    set((state) => ({
      itinerary,
      error: null,
      history: state.itinerary ? [...state.history, state.itinerary].slice(-MAX_HISTORY) : state.history,
    })),
  undo: () =>
    set((state) => {
      if (state.history.length === 0) return state;
      return { itinerary: state.history[state.history.length - 1], history: state.history.slice(0, -1) };
    }),
  setLoading: (loading) => set({ loading }),
  setEditingLoading: (loading) => set({ editingLoading: loading }),
  setError: (error) => set({ error }),
  reset: () => set({ itinerary: null, history: [], error: null }),
}));
