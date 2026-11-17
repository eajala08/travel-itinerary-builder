import type { ItineraryResponse } from '../types/itinerary';
import { useMoney } from '../lib/settings';

const CATEGORIES = [
  { key: 'food', label: 'Food', color: 'var(--it-noon)' },
  { key: 'activities', label: 'Activities', color: 'var(--it-night)' },
  { key: 'transport', label: 'Transport', color: 'var(--moss)' },
  { key: 'shopping', label: 'Shopping', color: 'var(--it-morning)' },
] as const;

export default function BudgetBreakdown({ itinerary }: { itinerary: ItineraryResponse }) {
  const money = useMoney();
  const { budget_breakdown, total_budget, estimated_spend, duration_days } = itinerary;
  const share = (amount: number) => (total_budget ? (amount / total_budget) * 100 : 0);

  return (
    <div className="it-glass it-budget">
      <div className="it-budget-head">
        <span>
          <b>{money(estimated_spend)}</b> of {money(total_budget)} planned
        </span>
        <span className="it-faint">{money(estimated_spend / Math.max(duration_days, 1))} / day</span>
      </div>
      <div className="it-budget-bar" role="img" aria-label="Spending by category">
        {CATEGORIES.map((c) => (
          <span key={c.key} style={{ width: `${share(budget_breakdown[c.key])}%`, background: c.color }} />
        ))}
      </div>
      <ul className="it-budget-legend">
        {CATEGORIES.map((c) => (
          <li key={c.key}>
            <i style={{ background: c.color }} />
            {c.label} <b>{money(budget_breakdown[c.key])}</b>
          </li>
        ))}
        <li>
          <i className="it-buffer-swatch" />
          Left over <b>{money(budget_breakdown.buffer)}</b>
        </li>
      </ul>
      <p className="it-faint it-small">Covers activities, food, local transport, and shopping. Flights and lodging aren't included.</p>
    </div>
  );
}
