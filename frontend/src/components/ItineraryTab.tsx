import { useState, useEffect } from 'react';
import type { ItineraryResponse } from '../types/itinerary';
import { buildTimeline, isRainy } from '../lib/timeline';
import { DAY_COLORS } from '../lib/constants';
import { useDistance, useMoney } from '../lib/settings';
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

const LONG_WALK_MIN = 25;

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

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
  const money = useMoney();
  const distance = useDistance();
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  useEffect(() => {
    setActiveDayIndex(0);
  }, [itinerary?.destination, itinerary?.dates?.[0]]);

  const day = itinerary?.itinerary[activeDayIndex];
  const stops = day ? buildTimeline(day) : [];
  const dayColor = DAY_COLORS[activeDayIndex % DAY_COLORS.length];
  const walkMinutes = day?.route?.legs.reduce((sum, leg) => sum + leg.duration_min, 0) ?? 0;

  return (
    <div className="itinerary-tab">
      <div className="it-topbar">
        <button className="it-back" type="button" onClick={onBack}>
          ← Trip Builder
        </button>
        {itinerary && (
          <div className="it-actions">
            <button type="button" className="it-action-btn it-primary" onClick={onSave}>
              {justSaved ? '✓ Saved' : 'Save trip'}
            </button>
            <ExportButton itinerary={itinerary} />
          </div>
        )}
      </div>

      {loading && (
        <div className="it-glass it-state" role="status">
          <div className="it-skeleton" />
          <div className="it-skeleton short" />
          <p style={{ marginTop: 8 }}>Finding real places, checking the forecast, and mapping walking routes…</p>
        </div>
      )}

      {!loading && !itinerary && !error && (
        <div className="it-glass it-state">
          <span className="it-state-icon">✦</span>
          <h2>No itinerary yet</h2>
          <p>Fill in a destination and dates in Trip Builder, then hit "Build my trip". It opens here.</p>
          <button className="it-action-btn it-primary" style={{ marginTop: 8 }} type="button" onClick={onBack}>
            Go to Trip Builder →
          </button>
        </div>
      )}

      {!loading && error && !itinerary && (
        <div className="it-glass it-state it-state-error" role="alert">
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
              {formatDate(itinerary.dates[0])} – {formatDate(itinerary.dates[itinerary.dates.length - 1])} ·{' '}
              {itinerary.duration_days} {itinerary.duration_days === 1 ? 'day' : 'days'}
            </p>
            <div className="it-hero-stats">
              <div>
                <b>{money(itinerary.estimated_spend)}</b>
                <span>Planned</span>
              </div>
              <div>
                <b>{money(itinerary.total_budget)}</b>
                <span>Budget</span>
              </div>
              <div>
                <b>{money(itinerary.budget_breakdown.buffer)}</b>
                <span>Left over</span>
              </div>
            </div>
          </div>

          {itinerary.warnings.length > 0 && (
            <div className="it-glass it-warning" role="status">
              {itinerary.warnings.map((w) => (
                <div key={w}>⚠ {w}</div>
              ))}
            </div>
          )}

          <div className="it-day-tabs" role="tablist">
            {itinerary.itinerary.map((d, idx) => (
              <button
                key={d.day}
                type="button"
                role="tab"
                aria-selected={idx === activeDayIndex}
                className={`it-day-tab${idx === activeDayIndex ? ' active' : ''}`}
                style={{ ['--day' as string]: DAY_COLORS[idx % DAY_COLORS.length] }}
                onClick={() => setActiveDayIndex(idx)}
              >
                <small>
                  DAY {d.day} · {formatDate(d.date)}
                </small>
                <b>{d.theme}</b>
              </button>
            ))}
          </div>

          {day && (
            <section className="it-day" aria-busy={editingLoading}>
              <div className="it-day-bar">
                <div className="it-day-meta">
                  {day.weather && (
                    <span>
                      {day.weather.condition}, {Math.round(day.weather.temp_c)}°C · {day.weather.advice}
                    </span>
                  )}
                  {walkMinutes > 0 && <span>🚶 about {walkMinutes} min walking</span>}
                  <span>{money(day.daily_spend.total)} today</span>
                </div>
                <div className="it-day-actions">
                  {isRainy(day) && (
                    <button
                      type="button"
                      className="it-action-btn"
                      disabled={editingLoading}
                      onClick={() =>
                        onEdit('Swap outdoor activities on this rainy day for indoor alternatives.', day.day)
                      }
                    >
                      Adjust for rain
                    </button>
                  )}
                  <button
                    type="button"
                    className="it-action-btn"
                    disabled={editingLoading}
                    onClick={() =>
                      onEdit('Replace this day with a different set of places that still fit my interests.', day.day)
                    }
                  >
                    {editingLoading ? 'Updating…' : '↻ Regenerate day'}
                  </button>
                </div>
              </div>

              <div className="it-day-grid">
                <ol className="it-timeline">
                  {stops.map((stop, idx) => (
                    <li key={idx}>
                      <div className="it-glass it-tl-card">
                        <div className="it-tl-time">{stop.time}</div>
                        <div>
                          <p className="it-tl-label">
                            <span className="it-stop-num" style={{ background: dayColor }}>
                              {idx + 1}
                            </span>
                            <span className="it-tl-dot" style={{ color: SLOT_COLOR[stop.slot] }} />
                            {stop.label}
                            {!stop.verified && (
                              <span
                                className="it-unverified"
                                title="Not one of the places we looked up, so it isn't on the map. Check it before you go."
                              >
                                suggested
                              </span>
                            )}
                          </p>
                          <h3>{stop.title}</h3>
                          {stop.detail && <p>{stop.detail}</p>}
                          <span className={`it-tag${stop.isMeal ? ' warm' : ''}`}>
                            {stop.cost > 0 ? money(stop.cost) : 'Free'}
                          </span>
                        </div>
                      </div>
                      {stop.walkToNext && idx < stops.length - 1 && (
                        <p className="it-walk">
                          🚶 {Math.max(1, Math.round(stop.walkToNext.duration_min))} min walk ·{' '}
                          {distance(stop.walkToNext.distance_km)}
                          {stop.walkToNext.duration_min > LONG_WALK_MIN && ' · transit is probably faster'}
                        </p>
                      )}
                    </li>
                  ))}
                  {day.travel_tips && (
                    <li>
                      <div className="it-glass it-tl-card it-tip">
                        <div className="it-tl-time">Tip</div>
                        <p>{day.travel_tips}</p>
                      </div>
                    </li>
                  )}
                </ol>
                <div className="it-day-map">
                  <Map key={`${itinerary.destination}-${day.day}`} stops={stops} route={day.route} color={dayColor} />
                </div>
              </div>
            </section>
          )}

          <h2 className="it-section-title">Budget</h2>
          <BudgetBreakdown itinerary={itinerary} />

          <h2 className="it-section-title">Adjust the whole trip</h2>
          <EditingBar onEdit={(instruction) => onEdit(instruction)} loading={editingLoading} />
        </>
      )}
    </div>
  );
}
