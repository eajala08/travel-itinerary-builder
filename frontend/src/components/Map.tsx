import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import type { MapPin } from '../types/itinerary';
import { DAY_COLORS } from '../lib/constants';
import 'leaflet/dist/leaflet.css';

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function Map({ pins }: { pins: MapPin[] }) {
  if (pins.length === 0) {
    return (
      <div className="bg-gray-100 rounded-xl h-96 flex items-center justify-center text-gray-500">
        No locations to show yet.
      </div>
    );
  }

  const avgLat = pins.reduce((sum, p) => sum + p.lat, 0) / pins.length;
  const avgLng = pins.reduce((sum, p) => sum + p.lng, 0) / pins.length;

  const pinsByDay = pins.reduce<Record<number, MapPin[]>>((acc, pin) => {
    (acc[pin.day] ||= []).push(pin);
    return acc;
  }, {});

  return (
    <div className="rounded-xl overflow-hidden shadow-md h-96 mb-6">
      <MapContainer center={[avgLat, avgLng]} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {Object.entries(pinsByDay).map(([day, dayPins]) => {
          const color = DAY_COLORS[(Number(day) - 1) % DAY_COLORS.length];
          return (
            <Polyline
              key={day}
              positions={dayPins.map((p) => [p.lat, p.lng])}
              pathOptions={{ color, weight: 3 }}
            />
          );
        })}
        {pins.map((pin, idx) => (
          <Marker key={idx} position={[pin.lat, pin.lng]} icon={markerIcon}>
            <Popup>
              <strong>{pin.name}</strong>
              <br />
              {pin.type} · Day {pin.day}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
