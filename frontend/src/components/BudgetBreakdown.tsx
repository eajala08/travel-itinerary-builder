import type { ItineraryResponse } from '../types/itinerary';
import { money } from '../lib/format';

export default function BudgetBreakdown({ itinerary }: { itinerary: ItineraryResponse }) {
  const { budget_breakdown, total_budget, estimated_spend, duration_days, dates } = itinerary;
  const remaining = total_budget - estimated_spend;
  const overBudget = remaining < 0;
  const percentSpent = total_budget > 0 ? Math.min((estimated_spend / total_budget) * 100, 100) : 0;

  const categories: { name: string; amount: number; color: string; emoji: string }[] = [
    { name: 'Food', amount: budget_breakdown.food, color: 'bg-amber-500', emoji: '🍽️' },
    { name: 'Activities', amount: budget_breakdown.activities, color: 'bg-purple-500', emoji: '🎫' },
    { name: 'Transport', amount: budget_breakdown.transport, color: 'bg-green-500', emoji: '🚆' },
    { name: 'Shopping', amount: budget_breakdown.shopping, color: 'bg-pink-500', emoji: '🛍️' },
    { name: 'Buffer', amount: budget_breakdown.buffer, color: 'bg-gray-400', emoji: '💰' },
  ];

  const maxDaily = Math.max(...itinerary.itinerary.map((d) => d.daily_spend.total), 1);

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Budget Breakdown</h2>

      <div className="mb-4">
        <div className="flex justify-between mb-1 text-sm">
          <span className="font-medium text-gray-700">Estimated spend</span>
          <span className="font-bold text-gray-800">
            {money(estimated_spend)} / {money(total_budget)}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full ${overBudget ? 'bg-red-500' : 'bg-gradient-to-r from-green-500 to-blue-500'}`}
            style={{ width: `${percentSpent}%` }}
          />
        </div>
        {overBudget ? (
          <p className="text-xs text-red-600 mt-1">
            {money(-remaining)} over budget. Try "Make it cheaper" below.
          </p>
        ) : (
          <p className="text-xs text-green-600 mt-1">{money(remaining)} buffer remaining</p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {categories.map((c) => (
          <div key={c.name} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">
              {c.emoji} {c.name}
            </p>
            <p className="text-lg font-bold text-gray-800">{money(c.amount)}</p>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div
                className={`${c.color} h-full rounded-full`}
                style={{ width: `${total_budget ? Math.min((c.amount / total_budget) * 100, 100) : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-semibold text-gray-700 mt-5 mb-2">Spend by day</h3>
      <div className="grid gap-1.5">
        {itinerary.itinerary.map((day, idx) => (
          <div key={day.day} className="flex items-center gap-2 text-xs text-gray-600">
            <span className="w-24 shrink-0">
              Day {day.day} · {(dates[idx] ?? day.date).slice(5)}
            </span>
            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full"
                style={{ width: `${(day.daily_spend.total / maxDaily) * 100}%` }}
              />
            </div>
            <span className="w-14 text-right font-medium text-gray-800">{money(day.daily_spend.total)}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        ~{money(estimated_spend / Math.max(duration_days, 1))}/day average. Covers activities, food, local transport,
        and shopping. Flights and lodging are not included.
      </p>
    </div>
  );
}
