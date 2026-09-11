import { useState, useEffect } from 'react';
import type { DayItinerary, ItineraryResponse } from '../types/itinerary';
import BudgetBreakdown from './BudgetBreakdown';
import Map from './Map';
import EditingBar from './EditingBar';
import ExportButton from './ExportButton';

interface TimelineEntry {
  time: string;
  slot: 'morning' | 'noon' | 'night';
  label: string;
  title: string;
  detail: string;
  tag: string;
  tagClass: string;
  cost: number;
}

function slotFor(time: string): TimelineEntry['slot'] {
  const hour = Number(time.split(':')[0] ?? 12);
  if (hour < 12) return 'morning';
  if (hour < 18) return 'noon';
  return 'night';
}

function buildTimeline(day: DayItinerary): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...day.activities.map((a) => ({
      time: a.time,
      slot: slotFor(a.time),
      label: a.type,
      title: a.name,
      detail: a.description,
      tag: a.estimated_cost > 0 ? `$${a.estimated_cost}` : 'Free',
      tagClass: '',
      cost: a.estimated_cost,
    })),
    ...day.meals.map((m) => ({
      time: m.time,
      slot: slotFor(m.time),
      label: m.type,
      title: m.name,
      detail: m.why || m.cuisine,
      tag: `$${m.budget}`,
      tagClass: 'warm',
      cost: m.budget,
    })),
  ];
  return entries.sort((a, b) => a.time.localeCompare(b.time));
}

const isRainy = (day: DayItinerary) =>
  !!day.weather &&
  (day.weather.precipitation_probability >= 50 || /rain|drizzle/i.test(day.weather.condition));

interface Props {
  itinerary: ItineraryResponse | null;
  loading: boolean;
  error: string | null;
  editingLoading: boolean;
  onEdit: (instruction: string, targetDay?: number) => void;
  onSave: () => void;
  justSaved: boolean;
}

export default function ItineraryPanel({
  itinerary,
  loading,
  error,
  editingLoading,
  onEdit,
  onSave,
  justSaved,
}: Props) {
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  useEffect(() => {
    setActiveDayIndex(0);
  }, [itinerary?.destination, itinerary?.dates?.[0]]);

  const activeDay = itinerary?.itinerary[activeDayIndex];

  return (
    <aside className="itinerary-panel">
      <div className="panel-dots">•••</div>

      <div className="trip-cover">
        <div className="cover-mountain" />
        <div className="cover-building one" />
        <div className="cover-building two" />
        <div className="cover-sun" />
        <div className="cover-text">
          <span>{itinerary ? 'YOUR TRIP' : 'PREVIEW'}</span>
          <b>{itinerary?.destination ?? 'Your itinerary'}</b>
        </div>
      </div>

      {!itinerary && (
        <div className="trip-empty">
          {loading
            ? 'Building your itinerary — fetching real places, weather, and routes first…'
            : error
              ? `⚠️ ${error}`
              : 'Fill in your trip details and hit "Build my trip" to see your day-by-day plan here.'}
        </div>
      )}

      {itinerary && activeDay && (
        <>
          <div className="trip-intro" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
            <div>
              <h2>{itinerary.destination}</h2>
              <p className="trip-meta">
                {itinerary.dates[0]} to {itinerary.dates[itinerary.dates.length - 1]} · {itinerary.duration_days} days ·{' '}
                ${itinerary.estimated_spend} / ${itinerary.total_budget}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" className="quick-prompt" onClick={onSave}>
                {justSaved ? '✓ Saved' : '💾 Save'}
              </button>
              <ExportButton itinerary={itinerary} />
            </div>
          </div>

          {itinerary.warnings.length > 0 && (
            <div className="trip-empty" style={{ padding: '10px 0', textAlign: 'left' }}>
              {itinerary.warnings.map((w) => (
                <div key={w}>⚠️ {w}</div>
              ))}
            </div>
          )}

          <div className="days-tabs">
            {itinerary.itinerary.map((day, idx) => (
              <button
                key={day.day}
                type="button"
                className={`day${idx === activeDayIndex ? ' active' : ''}`}
                onClick={() => setActiveDayIndex(idx)}
              >
                <small>DAY {day.day}</small>
                <b>{day.theme}</b>
              </button>
            ))}
          </div>

          <div className="timeline">
            {activeDay.weather && (
              <div className="item-label" style={{ marginBottom: 10 }}>
                {activeDay.weather.condition.toUpperCase()} · {activeDay.weather.temp_c}°C — {activeDay.weather.advice}
                {isRainy(activeDay) && (
                  <button
                    type="button"
                    className="quick-prompt"
                    style={{ marginLeft: 8 }}
                    disabled={editingLoading}
                    onClick={() =>
                      onEdit('Swap outdoor activities on this rainy day for indoor alternatives.', activeDay.day)
                    }
                  >
                    🌧️ Adjust for weather
                  </button>
                )}
              </div>
            )}

            {buildTimeline(activeDay).map((entry, idx) => (
              <div className="timeline-item" key={idx}>
                <time>{entry.time}</time>
                <div className={`timeline-dot ${entry.slot}`} />
                <div>
                  <p className="item-label">{entry.label}</p>
                  <h3>{entry.title}</h3>
                  <p>{entry.detail}</p>
                  <span className={`tag ${entry.tagClass}`}>{entry.tag}</span>
                </div>
              </div>
            ))}

            {activeDay.travel_tips && (
              <div className="timeline-item">
                <time />
                <div className="timeline-dot" style={{ background: 'var(--moss)' }} />
                <div>
                  <p className="item-label">TIP</p>
                  <p>{activeDay.travel_tips}</p>
                </div>
              </div>
            )}
          </div>

          <BudgetBreakdown itinerary={itinerary} />
          <Map pins={itinerary.map_pins} />
          <EditingBar onEdit={(instruction) => onEdit(instruction)} loading={editingLoading} />
        </>
      )}
    </aside>
  );
}
