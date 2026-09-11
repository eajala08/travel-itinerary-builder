import type { ItineraryResponse } from '../types/itinerary';

export interface SavedTrip {
  id: string;
  savedAt: string;
  itinerary: ItineraryResponse;
}

const STORAGE_KEY = 'travel-itinerary-builder:saved-trips';

export function getSavedTrips(): SavedTrip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedTrip[]) : [];
  } catch {
    return [];
  }
}

export function saveTrip(itinerary: ItineraryResponse): SavedTrip {
  const trip: SavedTrip = {
    id: `${Date.now()}`,
    savedAt: new Date().toISOString(),
    itinerary,
  };
  const trips = [trip, ...getSavedTrips()];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — save is a no-op.
  }
  return trip;
}

export function deleteTrip(id: string): void {
  const trips = getSavedTrips().filter((t) => t.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
  } catch {
    // ignore
  }
}
