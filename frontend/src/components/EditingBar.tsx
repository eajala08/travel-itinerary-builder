import { useState } from 'react';
import { EDIT_PRESETS } from '../lib/constants';

interface Props {
  onEdit: (instruction: string) => void;
  loading: boolean;
}

export default function EditingBar({ onEdit, loading }: Props) {
  const [customText, setCustomText] = useState('');

  const submitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim()) return;
    onEdit(customText.trim());
    setCustomText('');
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-800 mb-3">Adjust your trip</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        {EDIT_PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => onEdit(preset.instruction)}
            disabled={loading}
            className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-full disabled:opacity-50"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <form onSubmit={submitCustom} className="flex gap-2">
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Or tell it what to change, e.g. 'swap day 2 for more nightlife'"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Updating…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
