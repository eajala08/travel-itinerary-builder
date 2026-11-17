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

/**
 * Saves the trip. Pass the id of a previously saved trip to update it in
 * place (e.g. after AI edits) instead of creating a duplicate entry.
 */
export function saveTrip(itinerary: ItineraryResponse, existingId?: string | null): SavedTrip {
  const trip: SavedTrip = {
    id: existingId ?? `${Date.now()}`,
    savedAt: new Date().toISOString(),
    itinerary,
  };
  const trips = [trip, ...getSavedTrips().filter((t) => t.id !== trip.id)];
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
