interface Props {
  budget: number;
  onChange: (value: number) => void;
}

export default function BudgetCard({ budget, onChange }: Props) {
  return (
    <div className="budget-card">
      <div className="budget-heading">
        <div>
          <h2>Budget</h2>
          <p>Covers activities, food, local transport, shopping — not flights/hotels.</p>
        </div>
        <div className="budget-input">
          $
          <input
            type="number"
            min={50}
            step={50}
            value={budget}
            onChange={(e) => onChange(Math.max(50, Number(e.target.value) || 50))}
          />
        </div>
      </div>
    </div>
  );
}
