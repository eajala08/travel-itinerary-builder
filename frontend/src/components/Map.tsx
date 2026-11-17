import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { MapPin } from '../types/itinerary';
import { DAY_COLORS } from '../lib/constants';
import { mapsLink } from '../lib/format';
import 'leaflet/dist/leaflet.css';

const dayColor = (day: number) => DAY_COLORS[(day - 1) % DAY_COLORS.length];

// Numbered, day-colored markers drawn in CSS — no external marker images.
const iconCache: Record<string, L.DivIcon> = {};
function stopIcon(day: number, order: number): L.DivIcon {
  const key = `${day}-${order}`;
  return (iconCache[key] ||= L.divIcon({
    className: '',
    html: `<span class="map-stop" style="background:${dayColor(day)}">${order}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  }));
}

function FitBounds({ pins }: { pins: MapPin[] }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length === 0) return;
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])), { padding: [32, 32] });
  }, [map, pins]);
  return null;
}

interface Props {
  pins: MapPin[];
  /** When set, only this day's stops are shown. */
  day?: number | null;
}

export default function Map({ pins, day }: Props) {
  const visible = useMemo(
    () => pins.filter((p) => (p.lat || p.lng) && (day == null || p.day === day)),
    [pins, day]
  );

  const pinsByDay = useMemo(
    () =>
      visible.reduce<Record<number, MapPin[]>>((acc, pin) => {
        (acc[pin.day] ||= []).push(pin);
        return acc;
      }, {}),
    [visible]
  );

  if (visible.length === 0) {
    return (
      <div className="bg-gray-100 rounded-xl h-96 flex items-center justify-center text-gray-500">
        No locations to show for this selection.
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden shadow-md h-96 mb-6">
      <MapContainer center={[visible[0].lat, visible[0].lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds pins={visible} />
        {Object.entries(pinsByDay).map(([d, dayPins]) => (
          <Polyline
            key={d}
            positions={[...dayPins].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((p) => [p.lat, p.lng])}
            pathOptions={{ color: dayColor(Number(d)), weight: 3, dashArray: '6 6' }}
          />
        ))}
        {visible.map((pin, idx) => (
          <Marker
            key={`${pin.day}-${idx}`}
            position={[pin.lat, pin.lng]}
            icon={stopIcon(pin.day, pin.order ?? idx + 1)}
          >
            <Popup>
              <strong>{pin.name}</strong>
              <br />
              {pin.type} · Day {pin.day}
              {pin.order ? ` · Stop ${pin.order}` : ''}
              <br />
              <a href={mapsLink(pin.lat, pin.lng)} target="_blank" rel="noreferrer">
                Open in Google Maps ↗
              </a>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
