import type { SavedTrip } from '../lib/savedTrips';

interface Props {
  trips: SavedTrip[];
  onLoad: (trip: SavedTrip) => void;
  onDelete: (id: string) => void;
}

export default function SavedTripsList({ trips, onLoad, onDelete }: Props) {
  if (trips.length === 0) {
    return (
      <div className="brief-card">
        <div className="brief-top">
          <div className="spark">✦</div>
          <div>
            <h2>Saved trips</h2>
            <p>Nothing saved yet — build a trip, then hit "Save trip" to keep it here.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="brief-card">
      <div className="brief-top">
        <div className="spark">✦</div>
        <div>
          <h2>Saved trips</h2>
          <p>Saved in this browser only.</p>
        </div>
      </div>

      <div style={{ marginTop: 19, display: 'grid', gap: 8 }}>
        {trips.map((trip) => (
          <div key={trip.id} className="pref" style={{ cursor: 'default' }}>
            <span className="pref-icon culture">✈</span>
            <span style={{ flex: 1 }}>
              <b>{trip.itinerary.destination}</b>
              <small>
                {trip.itinerary.dates[0]} to {trip.itinerary.dates[trip.itinerary.dates.length - 1]} · $
                {trip.itinerary.total_budget} · saved {new Date(trip.savedAt).toLocaleDateString()}
              </small>
            </span>
            <button type="button" className="quick-prompt" onClick={() => onLoad(trip)}>
              Load
            </button>
            <button
              type="button"
              className="quick-prompt"
              style={{ marginLeft: 6 }}
              onClick={() => onDelete(trip.id)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
