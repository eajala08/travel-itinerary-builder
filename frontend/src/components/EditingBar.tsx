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
    if (!customText.trim() || loading) return;
    onEdit(customText.trim());
    setCustomText('');
  };

  return (
    <div className="it-glass it-edit">
      <div className="it-edit-presets">
        {EDIT_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="it-action-btn"
            onClick={() => onEdit(preset.instruction)}
            disabled={loading}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <form onSubmit={submitCustom} className="it-edit-form">
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Or describe a change, e.g. “swap day 2 for more nightlife”"
          aria-label="Describe a change to the trip"
        />
        <button type="submit" className="it-action-btn it-primary" disabled={loading || !customText.trim()}>
          {loading ? 'Updating…' : 'Apply'}
        </button>
      </form>
    </div>
  );
}
