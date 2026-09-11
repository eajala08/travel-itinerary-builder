import { SIGNATURE_PICKS } from '../lib/constants';

interface Props {
  selected: Set<string>;
  onToggle: (key: string) => void;
}

const MAX_SIGNATURES = 2;

export default function SignatureSection({ selected, onToggle }: Props) {
  return (
    <div className="signature-section">
      <div className="signature-heading">
        <h2>Signature experiences</h2>
        <span>Pick up to {MAX_SIGNATURES}</span>
      </div>
      <div className="signature-options">
        {SIGNATURE_PICKS.map((pick) => (
          <button
            key={pick.key}
            type="button"
            className={`signature${selected.has(pick.key) ? ' selected' : ''}`}
            onClick={() => onToggle(pick.key)}
          >
            <span>{pick.icon}</span>
            <b>{pick.label}</b>
            <small>{pick.sub}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
