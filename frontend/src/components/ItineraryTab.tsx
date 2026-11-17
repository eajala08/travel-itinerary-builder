import { useState } from 'react';
import type { ItineraryResponse } from '../types/itinerary';
import { buildTimeline, isRainy } from '../lib/timeline';
import { mapsLink, money } from '../lib/format';
import BudgetBreakdown from './BudgetBreakdown';
import Map from './Map';
import EditingBar from './EditingBar';
import ExportButton from './ExportButton';

interface Props {
  itinerary: ItineraryResponse | null;
  loading: boolean;
  error: string | null;
  editingLoading: boolean;
  onEdit: (instruction: string, targetDay?: number) => void;
  canUndo: boolean;
  onUndo: () => void;
  onSave: () => void;
  justSaved: boolean;
  onBack: () => void;
}

const SLOT_COLOR: Record<string, string> = {
  morning: 'var(--it-morning)',
  noon: 'var(--it-noon)',
  night: 'var(--it-night)',
};

// The parent keys this component by trip, so day selection resets for a new
// trip but survives AI edits to the current one.
export default function ItineraryTab({
  itinerary,
  loading,
  error,
  editingLoading,
  onEdit,
  canUndo,
  onUndo,
  onSave,
  justSaved,
  onBack,
}: Props) {
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [mapAllDays, setMapAllDays] = useState(false);

  const days = itinerary?.itinerary ?? [];
  const activeDay = days[Math.min(activeDayIndex, Math.max(days.length - 1, 0))];

  return (
    <div className="itinerary-tab">
      <div className="it-topbar">
        <button className="it-back" type="button" onClick={onBack}>
          ← Trip Builder
        </button>
        {itinerary && (
          <div className="it-actions">
            <button type="button" className="it-action-btn" onClick={onSave}>
              {justSaved ? '✓ Saved' : '💾 Save'}
            </button>
            <ExportButton itinerary={itinerary} />
          </div>
        )}
      </div>

      {loading && (
        <div className="it-glass it-state" role="status">
          <div className="it-skeleton" />
          <div className="it-skeleton short" />
          <p style={{ marginTop: 8 }}>Fetching real places, weather, and routes, then building your trip…</p>
        </div>
      )}

      {!loading && !itinerary && !error && (
        <div className="it-glass it-state">
          <span className="it-state-icon">✦</span>
          <h2>No itinerary yet</h2>
          <p>Head back to Trip Builder, fill in a destination and dates, and hit "Build my trip" — it'll open here.</p>
          <button className="it-action-btn it-primary" style={{ marginTop: 8 }} type="button" onClick={onBack}>
            Go to Trip Builder →
          </button>
        </div>
      )}

      {!loading && error && !itinerary && (
        <div className="it-glass it-state it-state-error">
          <span className="it-state-icon">⚠</span>
          <h2>Couldn't build this trip</h2>
          <p>{error}</p>
          <button className="it-action-btn it-primary" style={{ marginTop: 8 }} type="button" onClick={onBack}>
            Back to Trip Builder
          </button>
        </div>
      )}

      {itinerary && !loading && (
        <>
          <div className="it-hero">
            <p className="it-hero-eyebrow">Your trip</p>
            <h1>{itinerary.destination}</h1>
            <p>
              {itinerary.dates[0]} to {itinerary.dates[itinerary.dates.length - 1]} · {itinerary.duration_days} days
            </p>
            <div className="it-hero-stats">
              <div>
                <b>{money(itinerary.estimated_spend)}</b>
                <span>Estimated</span>
              </div>
              <div>
                <b>{money(itinerary.total_budget)}</b>
                <span>Budget</span>
              </div>
              <div>
                <b className={itinerary.estimated_spend > itinerary.total_budget ? 'it-over' : undefined}>
                  {money(itinerary.total_budget - itinerary.estimated_spend)}
                </b>
                <span>{itinerary.estimated_spend > itinerary.total_budget ? 'Over budget' : 'Buffer'}</span>
              </div>
            </div>
          </div>

          {itinerary.warnings.length > 0 && (
            <div className="it-glass it-warning">
              {itinerary.warnings.map((w) => (
                <div key={w}>⚠️ {w}</div>
              ))}
            </div>
          )}

          {editingLoading && (
            <div className="it-glass it-warning" role="status">
              ✦ Updating your trip…
            </div>
          )}

          <div className="it-day-tabs" role="tablist">
            {days.map((day, idx) => (
              <button
                key={day.day}
                type="button"
                role="tab"
                aria-selected={day === activeDay}
                className={`it-day-tab${day === activeDay ? ' active' : ''}`}
                onClick={() => setActiveDayIndex(idx)}
              >
                <small>
                  DAY {day.day}
                  {day.weather ? ` · ${Math.round(day.weather.temp_c)}°` : ''}
                  {isRainy(day) ? ' 🌧️' : ''}
                </small>
                <b>{day.theme}</b>
              </button>
            ))}
          </div>

          {activeDay && (
            <>
              {activeDay.weather && (
                <div className="it-glass it-weather">
                  <span>
                    {activeDay.weather.condition} · {activeDay.weather.temp_c}°C ·{' '}
                    {activeDay.weather.precipitation_probability}% rain — {activeDay.weather.advice}
                  </span>
                  {isRainy(activeDay) && (
                    <button
                      type="button"
                      className="it-action-btn"
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

              <p className="it-day-spend">
                Day {activeDay.day} spend: <b>{money(activeDay.daily_spend.total)}</b> · food{' '}
                {money(activeDay.daily_spend.food)} · activities {money(activeDay.daily_spend.activities)} · transport{' '}
                {money(activeDay.daily_spend.transport)}
              </p>

              <div className="it-timeline">
                {buildTimeline(activeDay).map((entry, idx) => (
                  <div className="it-glass it-tl-card" key={idx}>
                    <div className="it-tl-time">{entry.time}</div>
                    <div>
                      <p className="it-tl-label">
                        <span className="it-tl-dot" style={{ color: SLOT_COLOR[entry.slot] }} />
                        {entry.label}
                        {entry.duration ? ` · ${entry.duration}` : ''}
                      </p>
                      <h3>{entry.title}</h3>
                      <p>{entry.detail}</p>
                      <span className={`it-tag${entry.tagClass ? ' ' + entry.tagClass : ''}`}>{entry.tag}</span>
                      {entry.lat || entry.lng ? (
                        <a
                          className="it-directions"
                          href={mapsLink(entry.lat, entry.lng)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Directions ↗
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}

                {activeDay.travel_tips && (
                  <div className="it-glass it-tl-card">
                    <div className="it-tl-time" />
                    <div>
                      <p className="it-tl-label">Tip</p>
                      <p>{activeDay.travel_tips}</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <p className="it-section-title">Budget &amp; map</p>
          <div className="it-light-wrap">
            <BudgetBreakdown itinerary={itinerary} />
            <div className="flex items-center gap-2 mb-3 text-sm">
              <span className="text-gray-500">Map:</span>
              <button
                type="button"
                aria-pressed={!mapAllDays}
                onClick={() => setMapAllDays(false)}
                className={`px-3 py-1 rounded-full border ${!mapAllDays ? 'bg-gray-800 text-white' : 'bg-white'}`}
              >
                Day {activeDay?.day ?? 1}
              </button>
              <button
                type="button"
                aria-pressed={mapAllDays}
                onClick={() => setMapAllDays(true)}
                className={`px-3 py-1 rounded-full border ${mapAllDays ? 'bg-gray-800 text-white' : 'bg-white'}`}
              >
                All days
              </button>
            </div>
            <Map pins={itinerary.map_pins} day={mapAllDays ? null : activeDay?.day} />
          </div>

          <p className="it-section-title">Adjust this trip</p>
          <div className="it-light-wrap">
            <EditingBar
              onEdit={onEdit}
              loading={editingLoading}
              activeDay={activeDay?.day ?? 1}
              canUndo={canUndo}
              onUndo={onUndo}
            />
          </div>
        </>
      )}
    </div>
  );
}
