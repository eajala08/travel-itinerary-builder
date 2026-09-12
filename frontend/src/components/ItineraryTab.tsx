import { useState, useEffect } from 'react';
import type { ItineraryResponse } from '../types/itinerary';
import { buildTimeline, isRainy } from '../lib/timeline';
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
  onSave: () => void;
  justSaved: boolean;
  onBack: () => void;
}

const SLOT_COLOR: Record<string, string> = {
  morning: 'var(--it-morning)',
  noon: 'var(--it-noon)',
  night: 'var(--it-night)',
};

export default function ItineraryTab({
  itinerary,
  loading,
  error,
  editingLoading,
  onEdit,
  onSave,
  justSaved,
  onBack,
}: Props) {
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  useEffect(() => {
    setActiveDayIndex(0);
  }, [itinerary?.destination, itinerary?.dates?.[0]]);

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
        <div className="it-glass it-state">
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

      {itinerary && (
        <>
          <div className="it-hero">
            <p className="it-hero-eyebrow">Your trip</p>
            <h1>{itinerary.destination}</h1>
            <p>
              {itinerary.dates[0]} to {itinerary.dates[itinerary.dates.length - 1]} · {itinerary.duration_days} days
            </p>
            <div className="it-hero-stats">
              <div>
                <b>${itinerary.estimated_spend}</b>
                <span>Estimated</span>
              </div>
              <div>
                <b>${itinerary.total_budget}</b>
                <span>Budget</span>
              </div>
              <div>
                <b>${itinerary.total_budget - itinerary.estimated_spend}</b>
                <span>Buffer</span>
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

          <div className="it-day-tabs">
            {itinerary.itinerary.map((day, idx) => (
              <button
                key={day.day}
                type="button"
                className={`it-day-tab${idx === activeDayIndex ? ' active' : ''}`}
                onClick={() => setActiveDayIndex(idx)}
              >
                <small>DAY {day.day}</small>
                <b>{day.theme}</b>
              </button>
            ))}
          </div>

          {itinerary.itinerary[activeDayIndex] && (
            <>
              {itinerary.itinerary[activeDayIndex].weather && (
                <div className="it-glass it-weather">
                  <span>
                    {itinerary.itinerary[activeDayIndex].weather!.condition} ·{' '}
                    {itinerary.itinerary[activeDayIndex].weather!.temp_c}°C —{' '}
                    {itinerary.itinerary[activeDayIndex].weather!.advice}
                  </span>
                  {isRainy(itinerary.itinerary[activeDayIndex]) && (
                    <button
                      type="button"
                      className="it-action-btn"
                      disabled={editingLoading}
                      onClick={() =>
                        onEdit(
                          'Swap outdoor activities on this rainy day for indoor alternatives.',
                          itinerary.itinerary[activeDayIndex].day
                        )
                      }
                    >
                      🌧️ Adjust for weather
                    </button>
                  )}
                </div>
              )}

              <div className="it-timeline">
                {buildTimeline(itinerary.itinerary[activeDayIndex]).map((entry, idx) => (
                  <div className="it-glass it-tl-card" key={idx}>
                    <div className="it-tl-time">{entry.time}</div>
                    <div>
                      <p className="it-tl-label">
                        <span className="it-tl-dot" style={{ color: SLOT_COLOR[entry.slot] }} />
                        {entry.label}
                      </p>
                      <h3>{entry.title}</h3>
                      <p>{entry.detail}</p>
                      <span className={`it-tag${entry.tagClass ? ' ' + entry.tagClass : ''}`}>{entry.tag}</span>
                    </div>
                  </div>
                ))}

                {itinerary.itinerary[activeDayIndex].travel_tips && (
                  <div className="it-glass it-tl-card">
                    <div className="it-tl-time" />
                    <div>
                      <p className="it-tl-label">Tip</p>
                      <p>{itinerary.itinerary[activeDayIndex].travel_tips}</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <p className="it-section-title">Budget &amp; map</p>
          <div className="it-light-wrap">
            <BudgetBreakdown itinerary={itinerary} />
            <Map pins={itinerary.map_pins} />
          </div>

          <p className="it-section-title">Adjust this trip</p>
          <div className="it-light-wrap">
            <EditingBar onEdit={(instruction) => onEdit(instruction)} loading={editingLoading} />
          </div>
        </>
      )}
    </div>
  );
}
