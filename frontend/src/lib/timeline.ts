import type { DayItinerary } from '../types/itinerary';

export interface TimelineEntry {
  time: string;
  slot: 'morning' | 'noon' | 'night';
  label: string;
  title: string;
  detail: string;
  tag: string;
  tagClass: string;
}

export function slotFor(time: string): TimelineEntry['slot'] {
  const hour = Number(time.split(':')[0] ?? 12);
  if (hour < 12) return 'morning';
  if (hour < 18) return 'noon';
  return 'night';
}

export function buildTimeline(day: DayItinerary): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...day.activities.map((a) => ({
      time: a.time,
      slot: slotFor(a.time),
      label: a.type,
      title: a.name,
      detail: a.description,
      tag: a.estimated_cost > 0 ? `$${a.estimated_cost}` : 'Free',
      tagClass: '',
    })),
    ...day.meals.map((m) => ({
      time: m.time,
      slot: slotFor(m.time),
      label: m.type,
      title: m.name,
      detail: m.why || m.cuisine,
      tag: `$${m.budget}`,
      tagClass: 'warm',
    })),
  ];
  return entries.sort((a, b) => a.time.localeCompare(b.time));
}

export const isRainy = (day: DayItinerary) =>
  !!day.weather &&
  (day.weather.precipitation_probability >= 50 || /rain|drizzle/i.test(day.weather.condition));
