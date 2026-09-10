import type { ItineraryResponse, TripInput } from '../types/itinerary';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.detail || `Request to ${path} failed (${response.status})`);
  }
  return response.json();
}

export function generateItinerary(input: TripInput): Promise<ItineraryResponse> {
  return postJson<ItineraryResponse>('/generate-itinerary', input);
}

export function editItinerary(
  itinerary: ItineraryResponse,
  instruction: string,
  targetDay: number | null
): Promise<ItineraryResponse> {
  return postJson<ItineraryResponse>('/edit-itinerary', {
    itinerary,
    instruction,
    target_day: targetDay,
  });
}
