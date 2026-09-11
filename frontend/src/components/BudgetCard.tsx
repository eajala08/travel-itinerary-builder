interface Props {
  budget: number;
  onChange: (value: number) => void;
}

const MIN = 500;
const MAX = 8000;

export default function BudgetCard({ budget, onChange }: Props) {
  const clamp = (value: number) => Math.max(MIN, Math.min(MAX, value || MIN));
  const fillPercent = ((clamp(budget) - MIN) / (MAX - MIN)) * 100;

  return (
    <div className="budget-card">
      <div className="budget-heading">
        <div>
          <h2>Budget</h2>
          <p>Covers activities, food, local transport, shopping — not flights/hotels.</p>
        </div>
        <div className="budget-input">
          $
          <input type="number" value={budget} onChange={(e) => onChange(clamp(Number(e.target.value)))} />
        </div>
      </div>
      <input
        className="budget-range"
        type="range"
        min={MIN}
        max={MAX}
        step={50}
        value={clamp(budget)}
        style={{ ['--fill' as string]: `${fillPercent}%` }}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
      />
      <div className="budget-scale">
        <span>${MIN}</span>
        <span>${clamp(budget)}</span>
        <span>${MAX}</span>
      </div>
    </div>
  );
}
