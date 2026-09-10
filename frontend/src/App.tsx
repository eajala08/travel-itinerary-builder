import { useAppStore } from './lib/store';
import { editItinerary } from './lib/api';
import InputForm from './components/InputForm';
import ItineraryCard from './components/ItineraryCard';
import BudgetBreakdown from './components/BudgetBreakdown';
import Map from './components/Map';
import EditingBar from './components/EditingBar';
import ExportButton from './components/ExportButton';

function App() {
  const { itinerary, loading, error, editingLoading, setItinerary, setEditingLoading, setError, reset } =
    useAppStore();

  const handleEdit = async (instruction: string, targetDay: number | null = null) => {
    if (!itinerary) return;
    setEditingLoading(true);
    try {
      const updated = await editItinerary(itinerary, instruction, targetDay);
      setItinerary(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update itinerary.');
    } finally {
      setEditingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full mb-4" />
        <p className="text-lg text-gray-700">Building your itinerary…</p>
        <p className="text-sm text-gray-500 mt-1">Fetching real places, weather, and routes first.</p>
      </div>
    );
  }

  if (!itinerary) {
    return (
      <div className="min-h-screen bg-gray-50 py-10 px-4">
        <InputForm />
        {error && <p className="max-w-2xl mx-auto text-center text-red-600 mt-4">{error}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-start flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{itinerary.destination}</h1>
            <p className="text-gray-500">
              {itinerary.dates[0]} to {itinerary.dates[itinerary.dates.length - 1]} · {itinerary.duration_days} days
            </p>
          </div>
          <div className="flex gap-2">
            <ExportButton itinerary={itinerary} />
            <button
              onClick={reset}
              className="text-gray-600 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Start over
            </button>
          </div>
        </div>

        {itinerary.warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6 text-sm text-yellow-800">
            {itinerary.warnings.map((w, i) => (
              <p key={i}>⚠️ {w}</p>
            ))}
          </div>
        )}

        {error && <p className="text-red-600 mb-4">{error}</p>}

        <BudgetBreakdown itinerary={itinerary} />
        <Map pins={itinerary.map_pins} />
        <EditingBar onEdit={(instruction) => handleEdit(instruction)} loading={editingLoading} />

        {itinerary.itinerary.map((day) => (
          <ItineraryCard
            key={day.day}
            day={day}
            editingLoading={editingLoading}
            onAdjustForWeather={(dayNum) =>
              handleEdit('Swap outdoor activities on this rainy day for indoor alternatives.', dayNum)
            }
          />
        ))}
      </div>
    </div>
  );
}

export default App;
