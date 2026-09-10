import { useState } from 'react';
import type { DayItinerary } from '../types/itinerary';
import { ACTIVITY_EMOJI } from '../lib/constants';

interface Props {
  day: DayItinerary;
  onAdjustForWeather: (day: number) => void;
  editingLoading: boolean;
}

const isRainy = (day: DayItinerary) =>
  !!day.weather &&
  (day.weather.precipitation_probability >= 50 || /rain|drizzle/i.test(day.weather.condition));

const hasOutdoorActivity = (day: DayItinerary) =>
  day.activities.some((a) => a.type === 'nature' || a.type === 'sports');

export default function ItineraryCard({ day, onAdjustForWeather, editingLoading }: Props) {
  const [expanded, setExpanded] = useState(true);
  const rainyOutdoorDay = isRainy(day) && hasOutdoorActivity(day);

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 flex justify-between items-center hover:brightness-95 transition text-left"
      >
        <div>
          <h3 className="text-xl font-bold">
            Day {day.day} — {day.date}
          </h3>
          <p className="text-blue-100">{day.theme}</p>
        </div>
        <span className={`transform transition ${expanded ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {expanded && (
        <div className="p-6">
          {day.weather && (
            <div className="bg-blue-50 rounded-lg p-3 mb-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-gray-700">
                {day.weather.condition} · {day.weather.temp_c}°C · {day.weather.precipitation_probability}% precip —{' '}
                {day.weather.advice}
              </p>
              {rainyOutdoorDay && (
                <button
                  onClick={() => onAdjustForWeather(day.day)}
                  disabled={editingLoading}
                  className="text-xs font-medium bg-amber-500 text-white px-3 py-1.5 rounded-full hover:bg-amber-600 disabled:opacity-50"
                >
                  🌧️ Adjust for weather
                </button>
              )}
            </div>
          )}

          <h4 className="font-bold text-gray-800 mb-2">Activities</h4>
          {day.activities.map((activity, idx) => (
            <div key={idx} className="bg-gray-50 rounded-lg p-4 mb-3">
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{ACTIVITY_EMOJI[activity.type] ?? '📍'}</span>
                  <div>
                    <p className="font-bold text-gray-800">{activity.name}</p>
                    <p className="text-xs text-gray-500">
                      {activity.time} · {activity.duration}
                    </p>
                  </div>
                </div>
                <p className="text-green-600 font-bold">${activity.estimated_cost}</p>
              </div>
              <p className="text-sm text-gray-700">{activity.description}</p>
              {activity.address && <p className="text-xs text-gray-500 mt-1">📍 {activity.address}</p>}
            </div>
          ))}

          <h4 className="font-bold text-gray-800 mb-2 mt-4">Meals</h4>
          {day.meals.map((meal, idx) => (
            <div key={idx} className="bg-amber-50 rounded-lg p-4 mb-3">
              <div className="flex justify-between items-start mb-1">
                <div>
                  <p className="font-bold text-gray-800">{meal.name}</p>
                  <p className="text-xs text-gray-500">
                    {meal.type} · {meal.time} · {meal.cuisine}
                  </p>
                </div>
                <p className="text-green-600 font-bold">${meal.budget}</p>
              </div>
              {meal.why && <p className="text-sm text-gray-600 italic">{meal.why}</p>}
            </div>
          ))}

          <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500 mt-4">
            <p className="text-xs text-gray-600 mb-1">Daily spend</p>
            <div className="grid grid-cols-4 gap-2 text-sm">
              <div>
                <p className="text-gray-500">Food</p>
                <p className="font-bold">${day.daily_spend.food}</p>
              </div>
              <div>
                <p className="text-gray-500">Activities</p>
                <p className="font-bold">${day.daily_spend.activities}</p>
              </div>
              <div>
                <p className="text-gray-500">Transport</p>
                <p className="font-bold">${day.daily_spend.transport}</p>
              </div>
              <div>
                <p className="text-gray-500">Total</p>
                <p className="font-bold text-green-700">${day.daily_spend.total}</p>
              </div>
            </div>
          </div>

          {day.travel_tips && (
            <div className="mt-3 bg-yellow-50 rounded-lg p-3 border-l-4 border-yellow-500">
              <p className="text-sm text-yellow-800">
                <span className="font-bold">💡 Tip:</span> {day.travel_tips}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
