import type { ItineraryResponse } from '../types/itinerary';

function escapeText(text: string): string {
  return text.replace(/[\\,;]/g, (match) => `\\${match}`).replace(/\n/g, '\\n');
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

// Floating local time (no timezone/UTC offset) — the calendar app interprets
// it in the viewer's own local timezone. Fine for a single-user local app;
// not timezone-correct for a real product (see spec's scalability note).
function toICSDateTime(date: string, time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const [year, month, day] = date.split('-').map(Number);
  return `${year}${pad(month)}${pad(day)}T${pad(hours || 0)}${pad(minutes || 0)}00`;
}

function addMinutes(date: string, time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const start = new Date(`${date}T${pad(hours || 0)}:${pad(mins || 0)}:00`);
  start.setMinutes(start.getMinutes() + minutes);
  const y = start.getFullYear();
  const m = start.getMonth() + 1;
  const d = start.getDate();
  return `${y}${pad(m)}${pad(d)}T${pad(start.getHours())}${pad(start.getMinutes())}00`;
}

function parseDurationMinutes(duration: string): number {
  const match = duration.match(/([\d.]+)\s*h/i);
  if (match) return Math.round(parseFloat(match[1]) * 60);
  return 90;
}

export function buildICS(itinerary: ItineraryResponse): string {
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(
    now.getUTCHours()
  )}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const events: string[] = [];

  itinerary.itinerary.forEach((day) => {
    day.activities.forEach((activity, idx) => {
      const start = toICSDateTime(day.date, activity.time);
      const end = addMinutes(day.date, activity.time, parseDurationMinutes(activity.duration || '1.5h'));
      events.push(
        [
          'BEGIN:VEVENT',
          `UID:${day.date}-activity-${idx}-${activity.name.replace(/\s+/g, '')}@travel-itinerary-builder`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART:${start}`,
          `DTEND:${end}`,
          `SUMMARY:${escapeText(activity.name)}`,
          `DESCRIPTION:${escapeText(activity.description)}`,
          activity.address ? `LOCATION:${escapeText(activity.address)}` : '',
          'END:VEVENT',
        ]
          .filter(Boolean)
          .join('\r\n')
      );
    });

    day.meals.forEach((meal, idx) => {
      const start = toICSDateTime(day.date, meal.time);
      const end = addMinutes(day.date, meal.time, 60);
      events.push(
        [
          'BEGIN:VEVENT',
          `UID:${day.date}-meal-${idx}-${meal.name.replace(/\s+/g, '')}@travel-itinerary-builder`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART:${start}`,
          `DTEND:${end}`,
          `SUMMARY:${escapeText(`${meal.type[0].toUpperCase()}${meal.type.slice(1)}: ${meal.name}`)}`,
          `DESCRIPTION:${escapeText(meal.why || meal.cuisine)}`,
          meal.address ? `LOCATION:${escapeText(meal.address)}` : '',
          'END:VEVENT',
        ]
          .filter(Boolean)
          .join('\r\n')
      );
    });
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Travel Itinerary Builder//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}
