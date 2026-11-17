import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L, { type LatLngTuple } from 'leaflet';
import type { DayRoute } from '../types/itinerary';
import type { TimelineEntry } from '../lib/timeline';
import 'leaflet/dist/leaflet.css';

interface Props {
  stops: TimelineEntry[];
  route: DayRoute | null | undefined;
  color: string;
}

function stopIcon(n: number, color: string, isMeal: boolean) {
  return L.divIcon({
    className: 'it-map-pin-wrap',
    html: `<span class="it-map-pin${isMeal ? ' meal' : ''}" style="--pin:${color}">${n}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function FitToPoints({ points }: { points: LatLngTuple[] }) {
  const map = useMap();
  // Refit only when the stops actually change, not on every re-render.
  const fitKey = JSON.stringify(points);
  useEffect(() => {
    const pts: LatLngTuple[] = JSON.parse(fitKey);
    if (pts.length === 1) map.setView(pts[0], 15);
    else if (pts.length > 1) map.fitBounds(pts, { padding: [32, 32] });
  }, [map, fitKey]);
  return null;
}

export default function Map({ stops, route, color }: Props) {
  const mapped = stops
    .map((stop, i) => ({ stop, n: i + 1 }))
    .filter(({ stop }) => stop.lat !== null && stop.lng !== null);

  if (mapped.length === 0) {
    return <div className="it-map it-map-empty">No mapped stops for this day.</div>;
  }

  const points: LatLngTuple[] = mapped.map(({ stop }) => [stop.lat!, stop.lng!]);
  // Real street route when available; otherwise straight lines between stops.
  const line: LatLngTuple[] = route?.geometry.length ? route.geometry : points;

  return (
    <div className="it-map">
      <MapContainer center={points[0]} zoom={14} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToPoints points={line} />
        <Polyline positions={line} pathOptions={{ color, weight: 4, opacity: 0.8, dashArray: route ? undefined : '6 8' }} />
        {mapped.map(({ stop, n }) => (
          <Marker key={n} position={[stop.lat!, stop.lng!]} icon={stopIcon(n, color, stop.isMeal)}>
            <Popup>
              <strong>{stop.title}</strong>
              <br />
              {stop.time} · {stop.label}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
