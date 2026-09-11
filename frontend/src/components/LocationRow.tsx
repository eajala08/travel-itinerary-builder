import { VIBES } from '../lib/constants';

interface Props {
  activeVibe: string | null;
  onSelect: (key: string) => void;
}

export default function LocationRow({ activeVibe, onSelect }: Props) {
  return (
    <div className="location-row">
      <span>Trip vibe:</span>
      {VIBES.map((vibe) => (
        <button
          key={vibe.key}
          type="button"
          className={`vibe-chip${activeVibe === vibe.key ? ' active' : ''}`}
          onClick={() => onSelect(vibe.key)}
        >
          {vibe.label}
        </button>
      ))}
    </div>
  );
}
