import { PREF_ITEMS } from '../lib/constants';

interface Props {
  selected: Set<string>;
  onToggle: (key: string) => void;
  onClear: () => void;
}

export default function PreferencesGrid({ selected, onToggle, onClear }: Props) {
  return (
    <div className="preferences">
      <div className="section-heading">
        <h2>What are you into?</h2>
        <button type="button" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="preference-grid">
        {PREF_ITEMS.map((pref) => (
          <button
            key={pref.key}
            type="button"
            className={`pref${selected.has(pref.key) ? ' selected' : ''}`}
            onClick={() => onToggle(pref.key)}
          >
            <span className={`pref-icon ${pref.iconClass}`}>{pref.icon}</span>
            <span>
              <b>{pref.label}</b>
              <small>{pref.sub}</small>
            </span>
            <i>✓</i>
          </button>
        ))}
      </div>
    </div>
  );
}
