import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ItineraryResponse } from '../types/itinerary';

interface AppState {
  itinerary: ItineraryResponse | null;
  loading: boolean;
  editingLoading: boolean;
  error: string | null;

  setItinerary: (itinerary: ItineraryResponse) => void;
  setLoading: (loading: boolean) => void;
  setEditingLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      itinerary: null,
      loading: false,
      editingLoading: false,
      error: null,

      setItinerary: (itinerary) => set({ itinerary, error: null }),
      setLoading: (loading) => set({ loading }),
      setEditingLoading: (loading) => set({ editingLoading: loading }),
      setError: (error) => set({ error }),
      reset: () => set({ itinerary: null, error: null }),
    }),
    {
      // Keep the current trip across a page refresh; loading flags must not persist.
      name: 'travel-itinerary-builder:current-trip',
      partialize: (state) => ({ itinerary: state.itinerary }),
    }
  )
);
