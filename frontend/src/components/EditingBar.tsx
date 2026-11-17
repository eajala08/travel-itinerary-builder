import { useState } from 'react';
import { DAY_EDIT_PRESETS, EDIT_PRESETS } from '../lib/constants';

interface Props {
  /** targetDay is set when the edit should only touch one day. */
  onEdit: (instruction: string, targetDay?: number) => void;
  loading: boolean;
  activeDay: number;
  canUndo: boolean;
  onUndo: () => void;
}

export default function EditingBar({ onEdit, loading, activeDay, canUndo, onUndo }: Props) {
  const [customText, setCustomText] = useState('');
  const [scope, setScope] = useState<'trip' | 'day'>('trip');

  const target = scope === 'day' ? activeDay : undefined;
  const presets = scope === 'day' ? DAY_EDIT_PRESETS : EDIT_PRESETS;

  const submitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim() || loading) return;
    onEdit(customText.trim(), target);
    setCustomText('');
  };

  const scopeButton = (value: 'trip' | 'day', label: string) => (
    <button
      type="button"
      aria-pressed={scope === value}
      onClick={() => setScope(value)}
      className={`text-sm px-3 py-1.5 rounded-full border ${
        scope === value ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-xl font-bold text-gray-800">Adjust your trip</h2>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo || loading}
          className="text-sm text-gray-700 px-3 py-1.5 rounded-full border border-gray-300 hover:bg-gray-100 disabled:opacity-40"
          title="Restore the version before the last change"
        >
          ↩ Undo last change
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4" role="group" aria-label="What to change">
        <span className="text-sm text-gray-500">Change:</span>
        {scopeButton('trip', 'Whole trip')}
        {scopeButton('day', `Day ${activeDay} only`)}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {presets.map((preset) => (
          <button
            type="button"
            key={preset.label}
            onClick={() => onEdit(preset.instruction, target)}
            disabled={loading}
            className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-full disabled:opacity-50"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <form onSubmit={submitCustom} className="flex gap-2">
        <label htmlFor="edit-instruction" className="sr-only">
          Describe a change
        </label>
        <input
          id="edit-instruction"
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          maxLength={1000}
          placeholder={
            scope === 'day'
              ? `Tell it what to change on day ${activeDay}, e.g. 'add a sunset spot'`
              : "Or tell it what to change, e.g. 'swap day 2 for more nightlife'"
          }
          className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <button
          type="submit"
          disabled={loading || !customText.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Updating…' : 'Apply change'}
        </button>
      </form>
    </div>
  );
}
