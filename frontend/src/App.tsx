import { useState } from 'react';
import { useAppStore } from './lib/store';
import { generateItinerary, editItinerary } from './lib/api';
import { MAX_TRIP_DAYS, SIGNATURE_PICKS, VIBES } from './lib/constants';
import { daysBetween } from './lib/format';
import { deleteTrip, getSavedTrips, saveTrip, type SavedTrip } from './lib/savedTrips';
import type { Preferences, TripInput } from './types/itinerary';
import Sidebar, { type View } from './components/Sidebar';
import BriefCard from './components/BriefCard';
import PreferencesGrid from './components/PreferencesGrid';
import LocationRow from './components/LocationRow';
import BudgetCard from './components/BudgetCard';
import SignatureSection from './components/SignatureSection';
import ItineraryTab from './components/ItineraryTab';
import SavedTripsList from './components/SavedTripsList';

const today = new Date();
const in3Days = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
const toISODate = (d: Date) => d.toISOString().split('T')[0];

export default function App() {
  const {
    itinerary,
    history,
    loading,
    editingLoading,
    error,
    setItinerary,
    applyEdit,
    undo,
    setLoading,
    setEditingLoading,
    setError,
  } = useAppStore();

  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(toISODate(today));
  const [endDate, setEndDate] = useState(toISODate(in3Days));
  const [travelers, setTravelers] = useState(2);
  const [notes, setNotes] = useState('');
  const [budget, setBudget] = useState(1500);
  const [selectedPrefs, setSelectedPrefs] = useState<Set<string>>(new Set());
  const [activeVibe, setActiveVibe] = useState<string | null>(null);
  const [selectedSignatures, setSelectedSignatures] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [view, setView] = useState<View>('builder');
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>(() => getSavedTrips());
  const [justSaved, setJustSaved] = useState(false);
  // Id of the saved entry the current trip came from, so "Save" updates it instead of duplicating.
  const [savedId, setSavedId] = useState<string | null>(null);

  const showToast = (message: string, isError = false) => {
    setToast({ message, error: isError });
    setTimeout(() => setToast(null), 2800);
  };

  const togglePref = (key: string) => {
    setSelectedPrefs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSignature = (key: string) => {
    setSelectedSignatures((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (next.size >= 2) {
          const [first] = next;
          next.delete(first);
        }
        next.add(key);
      }
      return next;
    });
  };

  const buildInterests = (): Record<string, number> => {
    const interests: Record<string, number> = {};
    selectedPrefs.forEach((key) => {
      interests[key] = 8;
    });
    selectedSignatures.forEach((key) => {
      const pick = SIGNATURE_PICKS.find((p) => p.key === key);
      pick?.boosts.forEach((boostKey) => {
        interests[boostKey] = Math.max(interests[boostKey] ?? 0, 9);
      });
    });
    return interests;
  };

  const buildPreferences = (): Preferences => {
    const vibe = VIBES.find((v) => v.key === activeVibe);
    return {
      pace: vibe?.pace ?? 'moderate',
      tourist_level: vibe?.tourist_level ?? 'mixed',
      walking: vibe?.walking ?? 'moderate',
    };
  };

  const handleBuild = async () => {
    if (!destination.trim()) {
      showToast('Add a destination first', true);
      return;
    }
    if (endDate < startDate) {
      showToast('End date must be after the start date', true);
      return;
    }
    if (daysBetween(startDate, endDate) > MAX_TRIP_DAYS) {
      showToast(`Trips can be up to ${MAX_TRIP_DAYS} days`, true);
      return;
    }

    const input: TripInput = {
      destination: destination.trim(),
      start_date: startDate,
      end_date: endDate,
      budget,
      travelers,
      interests: buildInterests(),
      preferences: buildPreferences(),
      notes,
    };

    setLoading(true);
    setError(null);
    try {
      const result = await generateItinerary(input);
      setItinerary(result);
      setSavedId(null);
      showToast('Your trip is ready ✨');
      setView('itinerary');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate itinerary.';
      setError(message);
      showToast(message, true);
      setView('itinerary');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (instruction: string, targetDay?: number) => {
    if (!itinerary) return;
    setEditingLoading(true);
    try {
      const updated = await editItinerary(itinerary, instruction, targetDay ?? null);
      applyEdit(updated);
      showToast(targetDay ? `Day ${targetDay} updated` : 'Trip updated');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update itinerary.';
      setError(message);
      showToast(message, true);
    } finally {
      setEditingLoading(false);
    }
  };

  const handleSave = () => {
    if (!itinerary) return;
    const saved = saveTrip(itinerary, savedId);
    setSavedId(saved.id);
    setSavedTrips(getSavedTrips());
    setJustSaved(true);
    showToast(savedId ? 'Saved trip updated' : 'Trip saved');
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handleLoadSavedTrip = (trip: SavedTrip) => {
    setItinerary(trip.itinerary);
    setSavedId(trip.id);
    setDestination(trip.itinerary.destination);
    setStartDate(trip.itinerary.dates[0]);
    setEndDate(trip.itinerary.dates[trip.itinerary.dates.length - 1]);
    setBudget(trip.itinerary.total_budget);
    setView('itinerary');
    showToast('Trip loaded');
  };

  const handleDeleteSavedTrip = (id: string) => {
    deleteTrip(id);
    if (id === savedId) setSavedId(null);
    setSavedTrips(getSavedTrips());
  };

  return (
    <div className="app-shell">
      <Sidebar view={view} onNavigate={setView} hasItinerary={!!itinerary} />

      {view === 'itinerary' ? (
        <ItineraryTab
          key={itinerary ? `${itinerary.destination}|${itinerary.dates[0]}` : 'empty'}
          itinerary={itinerary}
          loading={loading}
          error={error}
          editingLoading={editingLoading}
          onEdit={handleEdit}
          canUndo={history.length > 0}
          onUndo={() => {
            undo();
            showToast('Reverted last change');
          }}
          onSave={handleSave}
          justSaved={justSaved}
          onBack={() => setView('builder')}
        />
      ) : (
        <main className="content">
          <div className="topbar">
            <span>TRAVEL PLANNER</span>
          </div>

          <div className="hero-copy">
            <p className="eyebrow">REAL DATA + AI</p>
            <h1>
              Plan trips that <em>actually</em> fit your life.
            </h1>
            <p>
              We pull real places, weather, and routes, then build a budget-aware itinerary around what you're
              actually into.
            </p>
          </div>

          {view === 'saved' ? (
            <SavedTripsList trips={savedTrips} onLoad={handleLoadSavedTrip} onDelete={handleDeleteSavedTrip} />
          ) : (
            <>
              <BriefCard
                destination={destination}
                onDestinationChange={setDestination}
                startDate={startDate}
                onStartDateChange={setStartDate}
                endDate={endDate}
                onEndDateChange={setEndDate}
                travelers={travelers}
                onTravelersChange={setTravelers}
                notes={notes}
                onNotesChange={setNotes}
              />

              <PreferencesGrid
                selected={selectedPrefs}
                onToggle={togglePref}
                onClear={() => setSelectedPrefs(new Set())}
              />

              <LocationRow
                activeVibe={activeVibe}
                onSelect={(key) => setActiveVibe((prev) => (prev === key ? null : key))}
              />

              <BudgetCard budget={budget} onChange={setBudget} />

              <SignatureSection selected={selectedSignatures} onToggle={toggleSignature} />

              <button type="button" className="build-button" disabled={loading} onClick={handleBuild}>
                {loading ? 'Building your trip…' : 'Build my trip'}
                <span className="build-arrow">→</span>
              </button>
            </>
          )}
        </main>
      )}

      <div id="toast" className={`toast${toast ? ' show' : ''}${toast?.error ? ' error' : ''}`}>
        {toast?.message}
      </div>
    </div>
  );
}
