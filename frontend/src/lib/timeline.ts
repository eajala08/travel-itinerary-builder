import type { DayItinerary, RouteLeg } from '../types/itinerary';

export interface TimelineEntry {
  time: string;
  slot: 'morning' | 'noon' | 'night';
  label: string;
  title: string;
  detail: string;
  cost: number;
  isMeal: boolean;
  verified: boolean;
  lat: number | null;
  lng: number | null;
  /** Walk from this stop to the next one, when a route is known. */
  walkToNext: RouteLeg | null;
}

export function slotFor(time: string): TimelineEntry['slot'] {
  const hour = Number(time.split(':')[0] ?? 12);
  if (hour < 12) return 'morning';
  if (hour < 18) return 'noon';
  return 'night';
}

export function buildTimeline(day: DayItinerary): TimelineEntry[] {
  const entries = [
    ...day.activities.map((a) => ({
      time: a.time,
      slot: slotFor(a.time),
      label: a.type,
      title: a.name,
      detail: a.description,
      cost: a.estimated_cost,
      isMeal: false,
      verified: a.verified ?? false,
      lat: a.lat,
      lng: a.lng,
    })),
    ...day.meals.map((m) => ({
      time: m.time,
      slot: slotFor(m.time),
      label: m.type,
      title: m.name,
      detail: m.why || m.cuisine,
      cost: m.budget,
      isMeal: true,
      verified: m.verified ?? false,
      lat: m.lat,
      lng: m.lng,
    })),
  ].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));

  // The backend routes through stops in this same time order, so leg i is
  // the walk from stop i to stop i + 1.
  const legs = day.route?.legs ?? [];
  return entries.map((entry, i) => ({ ...entry, walkToNext: legs[i] ?? null }));
}

export const isRainy = (day: DayItinerary) =>
  !!day.weather &&
  (day.weather.precipitation_probability >= 50 || /rain|drizzle/i.test(day.weather.condition));
