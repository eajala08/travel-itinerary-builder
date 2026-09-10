import { useState } from 'react';
import { generateItinerary } from '../lib/api';
import { useAppStore } from '../lib/store';
import { INTEREST_OPTIONS } from '../lib/constants';
import type { Preferences, TripInput } from '../types/itinerary';

const today = new Date().toISOString().split('T')[0];

export default function InputForm() {
  const { setItinerary, setLoading, setError, loading } = useAppStore();

  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [budget, setBudget] = useState(1500);
  const [travelers, setTravelers] = useState(2);
  const [interestWeights, setInterestWeights] = useState<Record<string, number>>({});
  const [preferences, setPreferences] = useState<Preferences>({
    pace: 'moderate',
    tourist_level: 'mixed',
    walking: 'moderate',
  });
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const toggleInterest = (key: string) => {
    setInterestWeights((prev) => {
      const next = { ...prev };
      if (key in next) {
        delete next[key];
      } else {
        next[key] = 8;
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!destination.trim()) {
      setFormError('Destination is required.');
      return;
    }
    if (endDate < startDate) {
      setFormError('End date must be on or after the start date.');
      return;
    }
    if (Object.keys(interestWeights).length === 0) {
      setFormError('Select at least one interest.');
      return;
    }
    if (budget < 50) {
      setFormError('Budget must be at least $50.');
      return;
    }

    const input: TripInput = {
      destination: destination.trim(),
      start_date: startDate,
      end_date: endDate,
      budget,
      travelers,
      interests: interestWeights,
      preferences,
      notes,
    };

    setLoading(true);
    setError(null);
    try {
      const itinerary = await generateItinerary(input);
      setItinerary(itinerary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate itinerary.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl bg-white rounded-xl shadow-md p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-1">✈️ Travel Itinerary Builder</h1>
      <p className="text-gray-500 mb-6">Real data + AI, built around your budget and interests.</p>

      <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
      <input
        type="text"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        placeholder="e.g. Tokyo, Japan"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
      />

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Budget (USD)</label>
          <input
            type="number"
            min={50}
            step={50}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">Covers activities, food, local transport, shopping — not flights/hotels.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Travelers</label>
          <input
            type="number"
            min={1}
            value={travelers}
            onChange={(e) => setTravelers(Number(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      <label className="block text-sm font-medium text-gray-700 mb-2">Interests (select at least one)</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {INTEREST_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => toggleInterest(opt.key)}
            className={`px-3 py-2 rounded-full text-sm font-medium transition ${
              opt.key in interestWeights
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {opt.emoji} {opt.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pace</label>
          <select
            value={preferences.pace}
            onChange={(e) => setPreferences({ ...preferences, pace: e.target.value as Preferences['pace'] })}
            className="w-full px-2 py-2 border border-gray-300 rounded-lg"
          >
            <option value="relaxed">Relaxed</option>
            <option value="moderate">Moderate</option>
            <option value="packed">Packed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Style</label>
          <select
            value={preferences.tourist_level}
            onChange={(e) =>
              setPreferences({ ...preferences, tourist_level: e.target.value as Preferences['tourist_level'] })
            }
            className="w-full px-2 py-2 border border-gray-300 rounded-lg"
          >
            <option value="touristy">Touristy</option>
            <option value="mixed">Mixed</option>
            <option value="local">Local</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Walking</label>
          <select
            value={preferences.walking}
            onChange={(e) => setPreferences({ ...preferences, walking: e.target.value as Preferences['walking'] })}
            className="w-full px-2 py-2 border border-gray-300 rounded-lg"
          >
            <option value="avoid">Avoid</option>
            <option value="moderate">Moderate</option>
            <option value="lots">Lots</option>
          </select>
        </div>
      </div>

      <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="e.g. traveling solo, vegetarian, avoid crowds"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-6 focus:ring-2 focus:ring-blue-500 outline-none"
      />

      {formError && <p className="text-red-500 text-sm mb-4">{formError}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
      >
        {loading ? 'Generating your itinerary…' : 'Generate Itinerary'}
      </button>
    </form>
  );
}
